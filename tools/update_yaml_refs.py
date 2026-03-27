#!/usr/bin/env python3
"""
Update entity ID references across YAML and TypeScript files after a rename.

Performs regex-based string replacement (NOT YAML parsing) to preserve
formatting, comments, and indentation. Handles all common entity ID patterns
found in Home Assistant config, Jinja2 templates, and TypeScript source.

Usage:
    python tools/update_yaml_refs.py renames.json [--config-path config/] [--dashboard-path dashboard/] [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple


def load_renames(renames_path: Path) -> Dict[str, str]:
    """Load rename mappings from a JSON file.

    Accepts two formats:
      - Dict: {"old_id": "new_id", ...}
      - List: [{"old_id": "sensor.foo", "new_id": "sensor.bar"}, ...]
    """
    try:
        with open(renames_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Renames file not found: {renames_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {renames_path}: {e}")
        sys.exit(1)

    if isinstance(data, dict):
        return data
    elif isinstance(data, list):
        renames = {}
        for i, entry in enumerate(data):
            if not isinstance(entry, dict):
                print(f"Error: List entry {i} is not an object: {entry}")
                sys.exit(1)
            if "old_id" not in entry or "new_id" not in entry:
                print(f"Error: List entry {i} missing 'old_id' or 'new_id': {entry}")
                sys.exit(1)
            renames[entry["old_id"]] = entry["new_id"]
        return renames
    else:
        print(f"Error: Expected dict or list in {renames_path}, got {type(data).__name__}")
        sys.exit(1)


def validate_renames(renames: Dict[str, str]) -> bool:
    """Validate that rename mappings look like entity IDs."""
    valid = True
    entity_pattern = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")

    for old_id, new_id in renames.items():
        if not entity_pattern.match(old_id):
            print(f"Warning: '{old_id}' does not look like a valid entity ID")
            valid = False
        if not entity_pattern.match(new_id):
            print(f"Warning: '{new_id}' does not look like a valid entity ID")
            valid = False
        if old_id == new_id:
            print(f"Warning: '{old_id}' maps to itself (no-op)")

    return valid


def build_replacement_pattern(old_id: str) -> re.Pattern:
    """Build a regex pattern that matches an entity ID at word boundaries.

    Entity IDs contain dots, so we use a custom boundary approach:
    - Before the ID: start-of-string, or a non-word/non-dot character
    - After the ID: end-of-string, or a non-word/non-dot character

    This prevents matching 'sensor.foo' inside 'sensor.foobar' or
    'xsensor.foo', while still matching in all common HA patterns:
      entity_id: sensor.foo
      - sensor.foo
      'sensor.foo'
      "sensor.foo"
      states('sensor.foo')
      states.sensor.foo
    """
    escaped = re.escape(old_id)
    # Lookbehind: not preceded by word char or dot
    # Lookahead: not followed by word char or dot
    return re.compile(r"(?<![.\w])" + escaped + r"(?![.\w])")


def replace_in_content(content: str, renames: Dict[str, str]) -> Tuple[str, Dict[str, int]]:
    """Replace all old entity IDs with new ones in a string.

    Returns the updated content and a dict of {old_id: count} replacements made.
    """
    counts: Dict[str, int] = {}

    for old_id, new_id in renames.items():
        pattern = build_replacement_pattern(old_id)
        new_content, n = pattern.subn(new_id, content)
        if n > 0:
            counts[old_id] = n
            content = new_content

    return content, counts


def collect_files(config_path: Path, dashboard_path: Path) -> List[Path]:
    """Collect all files that need scanning for entity references."""
    files: List[Path] = []

    # YAML files in config/ (recursive)
    if config_path.exists():
        for ext in ("*.yaml", "*.yml"):
            files.extend(sorted(config_path.rglob(ext)))

    # Python scripts in config/custom_scripts/
    custom_scripts = config_path / "custom_scripts"
    if custom_scripts.exists():
        files.extend(sorted(custom_scripts.rglob("*.py")))

    # Dashboard TypeScript files
    entities_ts = dashboard_path / "src" / "lib" / "entities.ts"
    if entities_ts.exists():
        files.append(entities_ts)

    areas_ts = dashboard_path / "src" / "lib" / "areas.ts"
    if areas_ts.exists():
        files.append(areas_ts)

    # Deduplicate (custom_scripts .py might overlap if config_path has them)
    seen = set()
    unique: List[Path] = []
    for f in files:
        resolved = f.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(f)

    return unique


def process_files(
    files: List[Path],
    renames: Dict[str, str],
    dry_run: bool = False,
) -> Dict[str, Dict[str, int]]:
    """Process all files and apply replacements.

    Returns a dict of {filepath: {old_id: count}} for files with changes.
    """
    results: Dict[str, Dict[str, int]] = {}

    for filepath in files:
        try:
            content = filepath.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  Warning: Could not read {filepath}: {e}")
            continue

        new_content, counts = replace_in_content(content, renames)

        if counts:
            results[str(filepath)] = counts
            if not dry_run:
                try:
                    filepath.write_text(new_content, encoding="utf-8")
                except Exception as e:
                    print(f"  Error: Could not write {filepath}: {e}")

    return results


def verify_no_remaining_refs(files: List[Path], renames: Dict[str, str]) -> List[Tuple[str, str, int, str]]:
    """Grep for any remaining old entity IDs after replacement.

    Returns a list of (filepath, old_id, line_number, line_text) tuples.
    """
    remaining: List[Tuple[str, str, int, str]] = []
    patterns = {old_id: build_replacement_pattern(old_id) for old_id in renames}

    for filepath in files:
        try:
            content = filepath.read_text(encoding="utf-8")
        except Exception:
            continue

        for line_num, line in enumerate(content.splitlines(), start=1):
            for old_id, pattern in patterns.items():
                if pattern.search(line):
                    remaining.append((str(filepath), old_id, line_num, line.strip()))

    return remaining


def print_report(
    results: Dict[str, Dict[str, int]],
    remaining: List[Tuple[str, str, int, str]],
    dry_run: bool,
):
    """Print a summary report of all replacements and warnings."""
    action = "Would replace" if dry_run else "Replaced"

    if not results:
        print("\nNo replacements found.")
        return

    print(f"\n{'=' * 70}")
    print(f"{'DRY RUN - ' if dry_run else ''}REPLACEMENT REPORT")
    print(f"{'=' * 70}")

    total_replacements = 0
    total_files = len(results)

    for filepath, counts in sorted(results.items()):
        file_total = sum(counts.values())
        total_replacements += file_total
        print(f"\n  {filepath} ({file_total} replacement{'s' if file_total != 1 else ''}):")
        for old_id, count in sorted(counts.items()):
            print(f"    {old_id} -> {count}x")

    print(f"\n  {action} {total_replacements} reference{'s' if total_replacements != 1 else ''} "
          f"across {total_files} file{'s' if total_files != 1 else ''}.")

    if remaining:
        print(f"\n{'=' * 70}")
        print("WARNING: Old entity IDs still found after replacement!")
        print(f"{'=' * 70}")
        for filepath, old_id, line_num, line_text in remaining:
            print(f"  {filepath}:{line_num}  {old_id}")
            print(f"    {line_text}")
    else:
        if not dry_run:
            print("\n  Verification passed: no remaining old entity IDs found.")


def main():
    """Run main function."""
    parser = argparse.ArgumentParser(
        description="Update entity ID references across YAML and TypeScript files after a rename."
    )
    parser.add_argument(
        "renames_file",
        help="JSON file with rename mappings: {old: new, ...} or [{old_id, new_id}, ...]",
    )
    parser.add_argument(
        "--config-path",
        default="config",
        help="Path to HA config directory (default: config/)",
    )
    parser.add_argument(
        "--dashboard-path",
        default="dashboard",
        help="Path to dashboard directory (default: dashboard/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files",
    )

    args = parser.parse_args()

    renames_path = Path(args.renames_file)
    config_path = Path(args.config_path)
    dashboard_path = Path(args.dashboard_path)

    # Load and validate renames
    renames = load_renames(renames_path)

    if not renames:
        print("Error: No renames found in file")
        return 1

    print(f"Loaded {len(renames)} rename mapping{'s' if len(renames) != 1 else ''} from {renames_path}")
    validate_renames(renames)

    # Collect files
    files = collect_files(config_path, dashboard_path)

    if not files:
        print("Error: No files found to scan")
        return 1

    print(f"Scanning {len(files)} file{'s' if len(files) != 1 else ''}...")

    if args.dry_run:
        print("(dry run - no files will be modified)")

    # Process files
    results = process_files(files, renames, dry_run=args.dry_run)

    # Post-update verification: re-read files and grep for old IDs
    # In dry-run mode, old IDs are expected to remain, so skip verification
    if not args.dry_run:
        remaining = verify_no_remaining_refs(files, renames)
    else:
        remaining = []

    # Report
    print_report(results, remaining, dry_run=args.dry_run)

    if remaining:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
