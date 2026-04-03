---
name: setup-customize
description: >
  Run after setup-infrastructure to map rooms, entities, and preferences to the
  dashboard and automation templates. Conversational and resumable. Trigger phrases:
  "customize my home", "set up rooms", "configure automations", "map my entities",
  "set up my dashboard", "finish setup", "resume setup".
---

# Setup Customize

This skill maps your Home Assistant instance to the dashboard and automation templates
through a guided interview. It is **resumable** — if the conversation ends mid-way,
re-invoke this skill and it will pick up from the last checkpoint.

See `references/question-patterns.md` for detailed question wording and example answers
for each domain.

## Step 0: Check Prerequisites

Verify `setup-state.json` exists and infrastructure is complete:

```python
import json, sys, os
if not os.path.exists('setup-state.json'):
    print('NOT_READY'); sys.exit(0)
with open('setup-state.json') as f:
    state = json.load(f)
schema = state.get('schema_version', 0)
if schema > 1:
    print('SCHEMA_WARNING')
phase = state.get('session', {}).get('current_phase', '')
infra = state.get('infrastructure', {}).get('steps_completed', [])
if 'infrastructure_complete' in phase or 'pull' in infra:
    answers = state.get('answers', {})
    if answers.get('rooms') or phase.startswith('customize:'):
        print('RESUME')
        print(f'PHASE:{phase}')
        print(f'ROOMS_DONE:{",".join(answers.get("rooms", {}).keys())}')
    else:
        print('FRESH')
else:
    print('NOT_READY')
```

Run via `python3 -c "..."` and check the output:

- **`NOT_READY`**: Tell user to run `setup-infrastructure` first.
- **`SCHEMA_WARNING`**: State file from newer version — proceed with caution.
- **`RESUME`**: Load checkpoint. Tell user: "Welcome back! You were at [phase]. Rooms done: [list]. Continuing."
- **`FRESH`**: Begin from Phase 1.

### Checkpoint Writing Pattern

After EVERY user answer, update `setup-state.json` with granular progress:

```python
import json
def save_checkpoint(phase, answers_update=None, files_written=None):
    with open('setup-state.json') as f:
        state = json.load(f)
    state['session']['current_phase'] = phase
    if answers_update:
        state.setdefault('answers', {}).update(answers_update)
    if files_written:
        state.setdefault('files_written', []).extend(files_written)
    with open('setup-state.json', 'w') as f:
        json.dump(state, f, indent=2)
```

Example calls:
- `save_checkpoint('customize:room_mapping', {'rooms': {'living_room': {'light': '...', 'motion': '...'}}})`
- `save_checkpoint('customize:domain_selection', {'domains_selected': ['lighting', 'climate']})`
- `save_checkpoint('customize:notifications', {'notify_targets': {'primary': 'notify.mobile_app_x'}})`
- `save_checkpoint('customize:files', files_written=['config/automations/lighting.yaml'])`

## Step 1: Discover Entity + Area + Floor Registries

**Primary method: Use registry data.** Entity-to-room assignment should come from the
device/entity registries (via `area_id`) whenever possible. This is the authoritative source.

**Fallback: Name inference + user confirmation.** If the registries have sparse area
assignments (common in setups where the user hasn't organized areas in HA), you may infer
room assignments from entity ID naming patterns (e.g., `bedroom_motion` → bedroom).
However, when using name inference, you MUST:
1. Clearly mark inferred assignments as "inferred (not in registry)"
2. Ask the user to confirm ALL inferred assignments before proceeding
3. Never present inferred data as verified fact

### 1a. Query Floor + Area Registries

Get the authoritative room and floor structure:

```bash
source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws raw config/floor_registry/list" 2>/dev/null
source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH}.env; ha-ws raw config/area_registry/list" 2>/dev/null
```

This gives you:
- All floors with IDs and names
- All areas with `floor_id` assignments
- **Do NOT ask the user about floors if this data is available.**

### 1b. Query Device + Entity Registries

Get the authoritative entity-to-area mappings:

```bash
source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH}.env; ha-ws raw config/device_registry/list" 2>/dev/null
source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH}.env; ha-ws raw config/entity_registry/list" 2>/dev/null
```

**Entity-to-area resolution chain:**
1. Check `entity_registry` → if the entity has a direct `area_id`, use it
2. Otherwise, find the entity's `device_id` → look up that device in `device_registry` → use the device's `area_id`
3. If neither has an `area_id`, the entity is unassigned — note it but do NOT guess

### 1c. Query Entities by Domain

For each relevant domain, query the live entity list:

```bash
source .env
for domain in light binary_sensor sensor climate media_player camera cover vacuum remote switch; do
  ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH}.env; ha-ws entity list $domain" 2>/dev/null
done
```

### 1d. Build Verified Room-Entity Map

Cross-reference the entity list with the device/entity registry area assignments to build
a **verified** mapping. For each room, list:
- Lights (prefer zone/group entities over individual bulbs)
- Motion sensors (`binary_sensor.*` with `device_class: motion` or `occupancy`)
- Temperature sensors
- Climate entities (TRVs, AC units)
- Media players
- Cameras

**Before presenting any mapping to the user:** mark each assignment's source:
- **Registry:** directly from device/entity registry `area_id` — present as fact
- **Inferred:** from entity ID naming pattern — present with a `?` mark, ask user to confirm
- **Unassigned:** no area in registry and no clear naming pattern — ask the user

### 1e. Fallback: Local .storage Files

If SSH/ha-ws is unavailable, parse the local `.storage/` files (pulled by `make pull`):

```bash
source venv/bin/activate && python tools/entity_explorer.py --full 2>/dev/null | head -100
```

Or use the REST API as a last resort:

```bash
source .env && set -a && source .env && set +a && python3 -c "
import urllib.request, json, os
url = os.environ['HA_URL'] + '/api/states'
req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['HA_TOKEN']})
with urllib.request.urlopen(req) as r:
    states = json.load(r)
domains = {}
for s in states:
    d = s['entity_id'].split('.')[0]
    domains[d] = domains.get(d, 0) + 1
for d, c in sorted(domains.items()):
    print(f'{d}: {c} entities')
"
```

Summarize what was found: "Found X floors, Y areas, Z lights, W climate entities, ..."

## Step 2: Room Mapping (Phase 1)

See `references/question-patterns.md` → Phase 1 for question wording.

**Goal:** Build a `RoomConfig[]` array for `dashboard/src/lib/areas.ts`.

1. Present the **verified** room-entity map from Step 1d to the user. This should already
   include floor assignments (from the floor registry), entity assignments (from device/entity
   registries), and all detected sensors/lights/climate/media per room.
2. Ask the user to confirm, correct, or skip each room. Common corrections:
   - Merging rooms (e.g., kitchen + storage → one zone)
   - Renaming rooms for the dashboard
   - Skipping rooms they don't want on the dashboard
3. **Only ask about floors if the floor registry returned no data.** If floors are assigned
   in HA, use those values directly.
4. For each confirmed room, verify entity assignments match what the user expects.
   If any entity was listed as "unassigned" in Step 1d, ask the user to assign it.
5. Save progress to `setup-state.json` after each room confirmation.

**Generate `areas.ts`** once all rooms are confirmed:

```typescript
// dashboard/src/lib/areas.ts — generated by setup-customize
export interface RoomConfig {
  id: string;
  name: string;
  floor: number;
  icon: string;
  light?: string;           // primary light entity
  motionSensor?: string;
  temperatureSensor?: string;
  mediaPlayer?: string;
  climate?: string;
}

export const ROOMS: RoomConfig[] = [
  // REPLACE: Add your rooms here (generated from interview)
  // { id: "living_room", name: "Living Room", floor: 0, icon: "sofa", light: "light.living_room" },
];

// Maps HA person entity → display name
export const USER_ROOM_MAP: Record<string, string> = {};
```

## Step 3: Entity Specialization (Phase 2)

For each room, ask domain-specific questions:

**Lights:**
- Is the main light a Hue zone/group or individual bulbs?
- Any motion-triggered lights in this room? (entity ID)
- Luminance sensor? (for light-level gating)

**Climate:**
- Thermostat/TRV or AC unit?
- TRV entity ID (for zone control)

**Media:**
- TV / media player entity?
- Remote entity? (for IR/HDMI control)

Save answers to `setup-state.json` as you go.

## Step 4: Domain Selection (Phase 3)

Present automation domains as a checklist. Ask the user which apply to their setup:

```
Which automation domains do you want to set up?
□ Motion lights (auto on/off with motion sensors)
□ Activity modes (night mode, movie mode, work mode)
□ Climate scheduling (morning/night temperature changes)
□ Away mode (setback when nobody home)
□ Appliance tracking (washer/dishwasher state machine)
□ Health monitoring (integration watchdogs, battery alerts)
□ EV/Solar charging (if you have solar + EV)
□ AC solar heating (if you have solar + AC units)
□ None — I'll write my own automations
```

For each selected domain, note which automation template to use from
`docs/templates/config/automations/`.

## Step 5: Behavioral Interview (Phase 4)

Ask about preferences that drive automation behavior. See `references/question-patterns.md`
→ Phase 4 for full question bank.

Key questions:
- What time do you typically wake up on weekdays? Weekends?
- What time is bedtime on weekdays? Weekends?
- Who lives in the home? (for presence tracking — no custody/schedule details needed)
- Do you work from home? (drives `work_mode` auto-trigger)
- What's your preferred daytime temperature? Night temperature?
- Battery alert threshold? (default: 10%)
- Any devices that should NOT be automated? (creates exceptions list)

Save all answers to `setup-state.json`.

## Step 6: Notification Discovery (Phase 5)

Discover available notification targets:

```bash
set -a && source .env && set +a && python3 -c "
import urllib.request, json, os
url = os.environ['HA_URL'] + '/api/services'
req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['HA_TOKEN']})
with urllib.request.urlopen(req) as r:
    services = json.load(r)
notify = [s for s in services if s.get('domain') == 'notify']
for n in notify:
    for svc in n.get('services', {}).keys():
        print(f'notify.{svc}')
" 2>/dev/null
```

Alternatively, use SSH + ha-api (more reliable):
```bash
source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api search notify"
```

Ask the user which targets to use for:
- Primary notifications (most alerts)
- Critical alerts (security, health)

## Step 7: Helpers Merge

Read existing `configuration.yaml` and check if it already has `input_*` helpers:

```bash
grep -l "input_boolean:\|input_select:\|input_number:" config/configuration.yaml 2>/dev/null && echo "has_helpers" || echo "no_helpers"
```

**If existing helpers found:**
Show them and ask:
> "Your `configuration.yaml` already has input helpers. I can:
> (A) Keep them where they are and add only missing ones from the templates
> (B) Consolidate all helpers into `config/helpers.yaml` and use `!include helpers.yaml`
>
> Which do you prefer?"

**Never silently move or overwrite existing helpers.**

## Step 8: Generate Configuration Files

Based on all interview answers, generate:

### `dashboard/src/lib/entities.ts`

```typescript
// dashboard/src/lib/entities.ts — generated by setup-customize
// Edit this file to update entity mappings. Re-run setup-customize to regenerate.

// ── Modes ──────────────────────────────────────────────────────────────────
export const NIGHT_MODE = "input_boolean.night_mode";
export const MOVIE_MODE = "input_boolean.movie_mode";
export const WORK_MODE = "input_boolean.work_mode";
export const AWAY_MODE = "input_boolean.away_mode";
export const CLIMATE_MODE = "input_select.your_climate_mode"; // # REPLACE: or remove

// ── People ─────────────────────────────────────────────────────────────────
// Add your person entity IDs here
export const PERSONS: string[] = [];

// ── Add your entities below ────────────────────────────────────────────────
// (Generated from interview answers — each room's entities added here)
```

### Automation YAML files

For each selected domain, copy the template and substitute placeholder IDs:
- `your_room_motion_sensor` → actual entity ID from interview
- `your_notify_target` → chosen notification target
- `your_morning_work_day` (input_datetime) → keep as-is (user sets value in HA UI)

Copy template files to `config/automations/`:
```bash
# Example for lighting:
cp docs/templates/config/automations/lighting.yaml config/automations/lighting.yaml
# Then perform substitutions based on interview answers
```

### `docs/system-overview.md` and `docs/house-rules.md`

Populate the template sections with interview answers. Leave blank sections
with the original guidance comments for sections not covered.

## Step 9: Build + Deploy

1. Install dashboard dependencies (if not already installed):
   ```bash
   cd dashboard && npm install && cd ..
   ```

2. Verify TypeScript compiles cleanly before deploying:
   ```bash
   cd dashboard && npx tsc -b --noEmit && cd ..
   ```
   If this fails, fix the errors before proceeding. Common issues:
   - Entity constants with empty string `"" as EntityId` need actual entity IDs or removal
   - Missing `@types/*` packages → run `npm install` first

3. Run backup:
   ```bash
   make backup
   ```

4. Push configuration:
   ```bash
   make push
   ```

5. Deploy dashboard:
   ```bash
   make deploy-dashboard
   ```

6. Verify by asking the user to open HA and confirm the dashboard panel appears.
   Provide the URL: `http://[HA_URL]/custom-dashboard`

### Optional: Make the dashboard the default view

After the dashboard deploys successfully, ask the user:

> "Would you like to make this dashboard your default view when opening Home Assistant?
> This requires installing the [Custom Sidebar](https://github.com/Villhellm/custom-sidebar)
> plugin via HACS. If you don't have HACS, you can skip this — your dashboard is still
> accessible from the sidebar."

If the user wants this:

1. Verify HACS is installed:
   ```bash
   source .env && ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api state sensor.hacs" 2>/dev/null
   ```
   If HACS is not installed, tell the user to install it first from [hacs.xyz](https://hacs.xyz/) and skip this step.

2. Tell the user to install Custom Sidebar via HACS:
   - Open HA → HACS → Frontend → search "Custom Sidebar" → Install
   - This cannot be done via CLI — HACS frontend installations require the UI

3. Once confirmed installed, add the plugin to `configuration.yaml` under `frontend`:
   ```yaml
   frontend:
     extra_module_url:
       - /hacsfiles/custom-sidebar/custom-sidebar-plugin.js
   ```
   **Merge with existing `frontend:` block** — do not duplicate the key.

4. Create `config/custom-sidebar-config.yaml`:
   ```yaml
   default_path: /custom-dashboard
   ```

5. Push the config and tell the user to restart HA (this change requires a restart, not just a reload):
   ```bash
   make push
   ```

## Step 10: Save Completion Checkpoint

```bash
python3 -c "
import json, datetime
with open('setup-state.json') as f:
    state = json.load(f)
state['session']['current_step'] = 'customize_complete'
state['session']['steps_completed'].append('customize')
state['session']['completed_at'] = datetime.datetime.now().isoformat()
with open('setup-state.json', 'w') as f:
    json.dump(state, f, indent=2)
print('Setup complete. setup-state.json updated.')
"
```

## Completion Message

> "Setup complete! Your dashboard is deployed.
>
> **What's configured:**
> - [N] rooms mapped
> - [N] automation domains active
> - Dashboard entities wired
>
> **Next steps:**
> - Open HA companion app and navigate to your custom dashboard panel
> - Review `docs/house-rules.md` and fill in any sections that are still blank
> - If something's wrong, just tell me what to fix — all entity IDs are now in
>   `dashboard/src/lib/entities.ts` and `config/automations/*.yaml`"
