---
name: entity-rename
description: >
  Batch rename Home Assistant entities to follow a consistent naming convention.
  Discovers entities, proposes renames, executes via HA API, and updates all
  YAML/TypeScript references automatically. Trigger phrases: "rename entities",
  "fix entity names", "standardize entity IDs", "entity rename", "clean up names".
---

# Entity Rename Skill

Rename Home Assistant entities to follow a consistent `domain.{room}_{descriptor}`
convention. Updates all YAML automations, scripts, dashboard code, and .storage/
configs automatically.

See `references/naming-convention.md` for the full naming convention.
See `docs/solutions/tooling/entity-rename-lessons.md` for safety rules from production use.

## Step 0: Prerequisites

Verify the environment is ready:

```bash
# Check .env exists with HA connection
test -f .env && grep -q HA_TOKEN .env && echo "ENV_OK" || echo "ENV_MISSING"

# Check entity registry exists (needs make pull first)
test -f config/.storage/core.entity_registry && echo "REGISTRY_OK" || echo "REGISTRY_MISSING"

# Check ha-ws is available on HA instance
source .env 2>/dev/null
ssh "$SSH_USER@$HA_HOST" "command -v ha-ws" >/dev/null 2>&1 && echo "HAWS_OK" || echo "HAWS_MISSING"
```

- **`ENV_MISSING`**: Tell user to run `setup-infrastructure` first or create `.env` manually.
- **`REGISTRY_MISSING`**: Tell user to run `make pull` first.
- **`HAWS_MISSING`**: Install claude-code-ha on the HA instance:
  ```bash
  ssh "$SSH_USER@$HA_HOST" "bash ${HA_REMOTE_PATH}claude-code-ha/install.sh"
  ```
  See [danbuhler/claude-code-ha](https://github.com/danbuhler/claude-code-ha). Provides `ha-api` (REST) and `ha-ws` (WebSocket) CLI tools that run directly on HA.

## Step 1: Discovery

Parse local registry files to build a complete entity inventory:

```bash
source venv/bin/activate
python tools/entity_explorer.py config/ --full
```

This uses the device registry join (entity.device_id -> device.area_id) to resolve
areas for entities that don't have a direct area_id.

Present the inventory to the user grouped by area/room:
- Show entity count per area
- Highlight entities that don't follow the naming convention
- Flag entities with serial numbers, product names, or non-English names

## Step 2: Convention Proposal

For each non-conforming entity, propose a new name following `references/naming-convention.md`.

**Present renames grouped by room.** For each room, show:

```
Living Room (12 entities to rename):
  climate.jch_8862dcd1     -> climate.living_room_ac
  light.hue_ambiance_spot_1 -> light.living_room_spot_1
  ...
  [Approve all] [Edit] [Skip room]
```

**Before proposing each rename:**
1. Verify target entity_id doesn't already exist (safety rule 3)
2. Detect name collisions requiring two-step renames (safety rule 4)
3. For each device, enumerate ALL child entities (safety rule 2):
   - battery, calibration, heating, window_detection, anti_scaling, etc.
   - Use device_id from entity registry to find siblings

**Save approved renames to a JSON file** for batch execution:

```bash
# Write to entity-renames.json (or a temp batch file)
python3 -c "
import json
renames = [
    {'old_id': 'climate.jch_8862dcd1', 'new_id': 'climate.living_room_ac'},
    ...
]
with open('rename_batch.json', 'w') as f:
    json.dump(renames, f, indent=2)
"
```

## Step 3: Reference Scanning

Before executing, scan for all references to understand the blast radius:

```bash
source venv/bin/activate
python tools/update_yaml_refs.py rename_batch.json --dry-run
```

This shows which files reference each old entity ID and how many replacements
would be made. Present the summary to the user:

```
climate.jch_8862dcd1: 34 references across 5 files
  config/automations/climate.yaml: 18 refs
  config/scripts/climate.yaml: 8 refs
  config/configuration.yaml: 4 refs
  dashboard/src/lib/entities.ts: 2 refs
  config/automations.yaml: 2 refs
```

## Step 4: Batch Execution

Execute renames in batches, grouped by room. For EACH batch:

### 4a. Rename entities on HA

**Primary (ha-ws via SSH):**
```bash
# Rename a single entity
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws entity update sensor.old_name new_entity_id=sensor.new_name"

# Batch rename from a file
cat rename_batch.json | python3 -c "
import json, sys, subprocess
for r in json.load(sys.stdin):
    cmd = f'ha-ws entity update {r[\"old_id\"]} new_entity_id={r[\"new_id\"]}'
    print(f'Renaming: {r[\"old_id\"]} -> {r[\"new_id\"]}')
    subprocess.run(['ssh', '$HA_HOST', f'source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; {cmd}'])
"
```

**Alternative (Python script with WebSocket fallback):**
```bash
source venv/bin/activate
python tools/entity_rename.py rename_batch.json
```
Only needed if SSH is unavailable. The script connects directly via WebSocket.

### 4b. Update all YAML/TypeScript references locally

```bash
python tools/update_yaml_refs.py rename_batch.json
```

### 4c. Check for .storage/ files that need patching

If any renamed entities are in Adaptive Lighting zones, patch the zone config
on HA via SSH:

```bash
# Back up first (safety rule 10)
ssh "$SSH_USER@$HA_HOST" "cp ${HA_REMOTE_PATH}.storage/core.config_entries ${HA_REMOTE_PATH}.storage/core.config_entries.bak"

# Patch AL zone lights arrays
ssh "$SSH_USER@$HA_HOST" "python3 -c \"
import json
with open('${HA_REMOTE_PATH}.storage/core.config_entries') as f:
    data = json.load(f)
for entry in data.get('data', {}).get('entries', []):
    if entry.get('domain') == 'adaptive_lighting':
        opts = entry.get('options', {})
        lights = opts.get('lights', [])
        # Replace old IDs with new IDs
        opts['lights'] = [MAPPING.get(l, l) for l in lights]
with open('${HA_REMOTE_PATH}.storage/core.config_entries', 'w') as f:
    json.dump(data, f, indent=2)
print('AL zones patched')
\""
```

### 4d. Record in tracker

Append batch results to `entity-renames.json`:

```python
import json, datetime
with open('entity-renames.json') as f:
    tracker = json.load(f)
for rename in batch:
    tracker['renames'].append({
        'batch': batch_number,
        'date': datetime.date.today().isoformat(),
        'old_id': rename['old_id'],
        'new_id': rename['new_id'],
        'references_updated': rename.get('ref_count', 0),
    })
with open('entity-renames.json', 'w') as f:
    json.dump(tracker, f, indent=2)
```

### 4e. Validate (CRITICAL — after EVERY batch)

```bash
# Sync updated registry from HA
make pull

# Validate YAML references
make validate

# Grep for any remaining old entity IDs
for old_id in $(python3 -c "import json; [print(r['old_id']) for r in json.load(open('rename_batch.json'))]"); do
    echo "Checking: $old_id"
    grep -rn "$old_id" config/ dashboard/src/ || echo "  Clean"
done
```

If validation fails or old IDs remain, fix them before proceeding to the next batch.

## Step 5: Verification and Cleanup

After all batches complete:

1. Run `make push` to deploy updated YAML to HA
2. If AL zones were patched: **restart HA** (reload is not enough — safety rule 8)
3. Run `make validate` one final time
4. Reload automations: `ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api call automation reload"`
5. Check a few automations in the HA UI to verify they work with the new entity IDs

## Resume Support

If the conversation ends mid-rename:
- `entity-renames.json` tracks which renames have been completed
- On resume, read the tracker and skip already-completed renames
- The batch JSON file records the full plan; compare against tracker to find remaining work
