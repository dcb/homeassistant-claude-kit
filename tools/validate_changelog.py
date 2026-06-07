#!/usr/bin/env python3
"""Validate kit-changelog.yaml against the kit changelog schema.

The structured changelog (`kit-changelog.yaml`) is the source of truth the `release`
skill writes and the `upgrade` skill consumes across versions, so its shape is a
contract. This validator enforces that contract and guards against drift between the
fields it enforces and the file's own self-describing `schema:` block.

Pure Python (only PyYAML) — no extra dependencies beyond what the kit already uses.

Usage:  python tools/validate_changelog.py [path]   (default: kit-changelog.yaml)
Exit:   0 = valid, 1 = invalid (errors printed, each naming the entry + field).
"""

import sys
from pathlib import Path

import yaml

# The contract. Keys MUST match the inline `schema:` block in kit-changelog.yaml
# (the drift guard below checks this). `required` fields must be present on every entry.
FIELDS = {
    "id":             {"type": str,  "required": True},
    "version":        {"type": str,  "required": True},
    "type":           {"type": str,  "required": True,
                       "enum": ["fix", "feature", "change", "removed", "security"]},
    "breaking":       {"type": bool, "required": True},
    "title":          {"type": str,  "required": True},
    "commits":        {"type": list, "required": True},
    "conditions":     {"type": str,  "required": False},
    "detect":         {"type": str,  "required": False},
    "detect_hint":    {"type": dict, "required": False},
    "apply":          {"type": str,  "required": False},
    "default_action": {"type": str,  "required": True,
                       "enum": ["auto", "ask", "skip-if-absent"]},
}

DEFAULT_PATH = "kit-changelog.yaml"


def validate(doc) -> list:
    """Return a list of human-readable problems (empty list = valid)."""
    errors: list = []
    if not isinstance(doc, dict):
        return ["top level: expected a mapping with schema_version/schema/changes"]

    if doc.get("schema_version") != 1:
        errors.append(f"schema_version: expected 1, got {doc.get('schema_version')!r}")

    # Drift guard: the file's self-describing `schema:` block must match enforced FIELDS,
    # so the doc-block and the validator can never silently disagree.
    schema_block = doc.get("schema")
    if not isinstance(schema_block, dict):
        errors.append("schema: missing or not a mapping (the self-describing block)")
    else:
        missing = set(FIELDS) - set(schema_block)
        extra = set(schema_block) - set(FIELDS)
        if missing:
            errors.append(f"schema drift: fields enforced but not described in `schema:`: {sorted(missing)}")
        if extra:
            errors.append(f"schema drift: `schema:` describes unknown fields: {sorted(extra)}")

    changes = doc.get("changes")
    if not isinstance(changes, list):
        errors.append("changes: must be a list of entries")
        return errors

    seen_ids: set = set()
    for i, entry in enumerate(changes):
        if not isinstance(entry, dict):
            errors.append(f"changes[{i}]: must be a mapping")
            continue
        eid = entry.get("id", f"<index {i}>")
        loc = f"entry '{eid}'"
        if isinstance(eid, str):
            if eid in seen_ids:
                errors.append(f"{loc}: duplicate id")
            seen_ids.add(eid)

        for field, spec in FIELDS.items():
            if field not in entry:
                if spec["required"]:
                    errors.append(f"{loc}: missing required field '{field}'")
                continue
            val = entry[field]
            # bool is a subclass of int — check it strictly so `breaking: 1` is rejected.
            if spec["type"] is bool:
                if not isinstance(val, bool):
                    errors.append(f"{loc}: field '{field}' must be a boolean, got {type(val).__name__}")
                    continue
            elif not isinstance(val, spec["type"]):
                errors.append(f"{loc}: field '{field}' must be {spec['type'].__name__}, got {type(val).__name__}")
                continue
            if "enum" in spec and val not in spec["enum"]:
                errors.append(f"{loc}: field '{field}' = {val!r} not in {spec['enum']}")

        for key in entry:
            if key not in FIELDS:
                errors.append(f"{loc}: unknown field '{key}'")

    return errors


def main(argv) -> int:
    path = Path(argv[1]) if len(argv) > 1 else Path(DEFAULT_PATH)
    if not path.exists():
        print(f"error: {path} not found", file=sys.stderr)
        return 1
    try:
        doc = yaml.safe_load(path.read_text())
    except yaml.YAMLError as exc:
        print(f"error: {path} is not valid YAML: {exc}", file=sys.stderr)
        return 1

    errors = validate(doc)
    if errors:
        print(f"✗ {path}: {len(errors)} problem(s):", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    count = len(doc.get("changes", []))
    print(f"✓ {path}: valid ({count} change {'entry' if count == 1 else 'entries'})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
