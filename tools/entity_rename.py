#!/usr/bin/env python3
"""
Home Assistant Entity Rename Tool.

Rename entities in the HA entity registry using a JSON manifest of rename pairs.
Primary method: ha-ws via SSH (runs on HA instance). Fallback: WebSocket API via `websockets`.

Usage:
    python tools/entity_rename.py renames.json [--dry-run] [--config-path config/]
"""

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# .env loading (same pattern as reload_config.py)
# ---------------------------------------------------------------------------

def load_env_file(env_path: Optional[Path] = None) -> None:
    """Load environment variables from .env file."""
    env_file = env_path or Path(".env")
    if not env_file.exists():
        return
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


def get_ha_connection() -> Tuple[str, str]:
    """Return (ha_host, ha_token) from environment.

    Supports both HA_HOST (hostname only, e.g. homeassistant.local) and
    HA_URL (full URL, e.g. http://homeassistant.local:8123).
    """
    token = os.getenv("HA_TOKEN", "")
    if not token:
        print("Error: HA_TOKEN not found in environment or .env file")
        print("  Create a .env file with: HA_TOKEN=your_long_lived_access_token")
        sys.exit(1)

    # Prefer HA_HOST (project convention), fall back to HA_URL
    ha_host = os.getenv("HA_HOST", "")
    if not ha_host:
        ha_url = os.getenv("HA_URL", "")
        if ha_url:
            # Extract hostname from URL (strip protocol and port)
            ha_host = ha_url.split("://")[-1].split(":")[0].split("/")[0]
        else:
            ha_host = "homeassistant.local"

    return ha_host, token


# ---------------------------------------------------------------------------
# Entity registry helpers (offline, from local .storage copy)
# ---------------------------------------------------------------------------

def load_entity_registry(config_path: Path) -> Optional[List[Dict]]:
    """Load entities from local entity registry copy."""
    registry_path = config_path / ".storage" / "core.entity_registry"
    if not registry_path.exists():
        return None
    try:
        with open(registry_path, "r") as f:
            data = json.load(f)
        return data.get("data", {}).get("entities", [])
    except Exception as e:
        print(f"Warning: Could not load entity registry: {e}")
        return None


def build_entity_set(entities: List[Dict]) -> set:
    """Build a set of all entity_ids in the registry."""
    return {e["entity_id"] for e in entities}


# ---------------------------------------------------------------------------
# Pre-flight validation
# ---------------------------------------------------------------------------

def validate_renames(
    renames: List[Dict[str, str]],
    existing_ids: Optional[set],
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], List[Dict[str, str]]]:
    """Validate rename pairs and split into (valid, skipped, errors).

    Checks:
      - old_id and new_id are present
      - Domains match (can't rename sensor.x to binary_sensor.y)
      - old_id exists in the registry (if registry available)
      - new_id doesn't already exist (unless it equals old_id -> skip)
    """
    valid: List[Dict[str, str]] = []
    skipped: List[Dict[str, str]] = []
    errors: List[Dict[str, str]] = []

    for pair in renames:
        old_id = pair.get("old_id", "").strip()
        new_id = pair.get("new_id", "").strip()

        if not old_id or not new_id:
            errors.append({**pair, "reason": "missing old_id or new_id"})
            continue

        # Already at target name -> idempotent skip
        if old_id == new_id:
            skipped.append({**pair, "reason": "old_id == new_id (no-op)"})
            continue

        # Domain mismatch
        old_domain = old_id.split(".")[0]
        new_domain = new_id.split(".")[0]
        if old_domain != new_domain:
            errors.append({
                **pair,
                "reason": f"domain mismatch: {old_domain} != {new_domain}",
            })
            continue

        if existing_ids is not None:
            # Idempotent: old_id gone, new_id present -> already renamed
            if old_id not in existing_ids and new_id in existing_ids:
                skipped.append({**pair, "reason": "already renamed"})
                continue

            # Old entity doesn't exist (and new doesn't either -> truly missing)
            if old_id not in existing_ids:
                errors.append({**pair, "reason": f"old entity not found: {old_id}"})
                continue

            # Target already taken by a different entity
            if new_id in existing_ids:
                errors.append({
                    **pair,
                    "reason": f"target entity already exists: {new_id}",
                })
                continue

        valid.append(pair)

    return valid, skipped, errors


# ---------------------------------------------------------------------------
# Rename executors
# ---------------------------------------------------------------------------

def has_ha_ws(ha_host: str) -> bool:
    """Check whether ha-ws is available on the HA instance via SSH."""
    try:
        result = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", "-o", "BatchMode=yes", ha_host, "command -v ha-ws"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def rename_via_ha_ws(
    old_id: str,
    new_id: str,
    ha_host: str,
) -> Tuple[bool, str]:
    """Rename an entity using ha-ws on the HA instance via SSH."""
    cmd = f"source /etc/profile.d/claude-ha.sh 2>/dev/null; source /config/.env; ha-ws entity update {old_id} new_entity_id={new_id}"
    try:
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", ha_host, cmd],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return True, result.stdout.strip()
        return False, (result.stderr or result.stdout).strip()
    except subprocess.TimeoutExpired:
        return False, "ha-ws via SSH timed out (30s)"
    except Exception as e:
        return False, str(e)


async def rename_via_websocket(
    renames: List[Dict[str, str]],
    ha_host: str,
    token: str,
) -> List[Tuple[str, str, bool, str]]:
    """Rename entities via the HA WebSocket API.

    Returns list of (old_id, new_id, success, message).
    """
    try:
        import websockets
    except ImportError:
        return [
            (r["old_id"], r["new_id"], False, "websockets library not installed (pip install websockets)")
            for r in renames
        ]

    ws_url = f"ws://{ha_host}:8123/api/websocket"
    results: List[Tuple[str, str, bool, str]] = []

    try:
        async with websockets.connect(ws_url) as ws:
            # Wait for auth_required
            auth_req = json.loads(await ws.recv())
            if auth_req.get("type") != "auth_required":
                return [
                    (r["old_id"], r["new_id"], False, f"unexpected initial message: {auth_req.get('type')}")
                    for r in renames
                ]

            # Authenticate
            await ws.send(json.dumps({
                "type": "auth",
                "access_token": token,
            }))
            auth_resp = json.loads(await ws.recv())
            if auth_resp.get("type") != "auth_ok":
                msg = auth_resp.get("message", "authentication failed")
                return [
                    (r["old_id"], r["new_id"], False, msg)
                    for r in renames
                ]

            # Send rename commands sequentially (order matters for two-step renames)
            msg_id = 1
            for pair in renames:
                old_id = pair["old_id"]
                new_id = pair["new_id"]

                await ws.send(json.dumps({
                    "id": msg_id,
                    "type": "config/entity_registry/update",
                    "entity_id": old_id,
                    "new_entity_id": new_id,
                }))
                resp = json.loads(await ws.recv())

                if resp.get("success"):
                    results.append((old_id, new_id, True, "ok"))
                else:
                    error = resp.get("error", {})
                    error_msg = error.get("message", "unknown error")
                    results.append((old_id, new_id, False, error_msg))

                msg_id += 1

    except Exception as e:
        # Return failures for any remaining renames
        completed = {r[0] for r in results}
        for pair in renames:
            if pair["old_id"] not in completed:
                results.append((pair["old_id"], pair["new_id"], False, f"websocket error: {e}"))

    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    """Run entity rename tool."""
    parser = argparse.ArgumentParser(
        description="Rename Home Assistant entities from a JSON manifest",
    )
    parser.add_argument(
        "renames_file",
        type=Path,
        help="JSON file with rename pairs: [{\"old_id\": ..., \"new_id\": ...}, ...]",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be renamed without executing",
    )
    parser.add_argument(
        "--config-path",
        type=Path,
        default=Path("config"),
        help="Path to local HA config directory (for registry pre-flight checks)",
    )

    args = parser.parse_args()

    # Load .env
    load_env_file()

    # Load rename manifest
    if not args.renames_file.exists():
        print(f"Error: renames file not found: {args.renames_file}")
        return 1

    try:
        with open(args.renames_file, "r") as f:
            renames_data = json.load(f)
    except Exception as e:
        print(f"Error: could not parse renames file: {e}")
        return 1

    # Accept either a bare list or {"renames": [...]}
    if isinstance(renames_data, list):
        renames = renames_data
    elif isinstance(renames_data, dict) and "renames" in renames_data:
        renames = renames_data["renames"]
    else:
        print("Error: JSON must be a list of {old_id, new_id} or {\"renames\": [...]}")
        return 1

    if not renames:
        print("No renames to process.")
        return 0

    print(f"Loaded {len(renames)} rename pair(s) from {args.renames_file}")

    # Load entity registry for pre-flight checks
    existing_ids: Optional[set] = None
    entities = load_entity_registry(args.config_path)
    if entities is not None:
        existing_ids = build_entity_set(entities)
        print(f"Entity registry loaded: {len(existing_ids)} entities")
    else:
        print("Warning: entity registry not available, skipping pre-flight existence checks")

    # Validate
    valid, skipped, errors = validate_renames(renames, existing_ids)

    # Report skipped
    for item in skipped:
        print(f"  SKIP  {item.get('old_id', '?')} -> {item.get('new_id', '?')}  ({item['reason']})")

    # Report errors
    for item in errors:
        print(f"  ERROR {item.get('old_id', '?')} -> {item.get('new_id', '?')}  ({item['reason']})")

    if not valid:
        if errors:
            print(f"\nNo valid renames to execute ({len(errors)} error(s), {len(skipped)} skipped)")
            return 1
        print(f"\nAll {len(skipped)} rename(s) already applied.")
        return 0

    print(f"\n{len(valid)} rename(s) to execute, {len(skipped)} skipped, {len(errors)} error(s)")

    # Dry-run: just list what would happen
    if args.dry_run:
        print("\n-- DRY RUN (no changes will be made) --\n")
        for pair in valid:
            print(f"  WOULD RENAME  {pair['old_id']}  ->  {pair['new_id']}")
        if errors:
            return 1
        return 0

    # Get HA connection details
    ha_host, token = get_ha_connection()

    # Execute renames
    use_ssh = has_ha_ws(ha_host)
    if use_ssh:
        print(f"\nUsing ha-ws via SSH (host: {ha_host})")
    else:
        print(f"\nUsing WebSocket API fallback (host: {ha_host})")

    success_count = 0
    fail_count = 0

    if use_ssh:
        for pair in valid:
            old_id = pair["old_id"]
            new_id = pair["new_id"]
            ok, msg = rename_via_ha_ws(old_id, new_id, ha_host)
            if ok:
                print(f"  OK    {old_id}  ->  {new_id}")
                success_count += 1
            else:
                print(f"  FAIL  {old_id}  ->  {new_id}  ({msg})")
                fail_count += 1
    else:
        ws_results = asyncio.run(
            rename_via_websocket(valid, ha_host, token)
        )
        for old_id, new_id, ok, msg in ws_results:
            if ok:
                print(f"  OK    {old_id}  ->  {new_id}")
                success_count += 1
            else:
                print(f"  FAIL  {old_id}  ->  {new_id}  ({msg})")
                fail_count += 1

    # Summary
    print(f"\nDone: {success_count} succeeded, {fail_count} failed, {len(skipped)} skipped, {len(errors)} pre-flight error(s)")

    if fail_count > 0 or len(errors) > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
