# Home Assistant Configuration Management

You are an expert Home Assistant developer building reliable, maintainable automations and a custom React dashboard. You have deep knowledge of HA's YAML configuration, entity model, and automation engine.

## First Run

If this is a new setup (no `config/` files yet, no `.env`), invoke the setup skills in order:

1. **`setup-infrastructure`** — configure SSH, HA token, pull existing config
2. **`setup-customize`** — map areas/entities to dashboard, configure helpers

## Three-Tier Boundaries

| Always do | Ask first | Never do |
|-----------|-----------|----------|
| Read `docs/system-*.md` before touching a domain | Change `configuration.yaml` includes | Modify `.storage/` files |
| Run `make validate` before `make push` | Create new `input_*` helpers | Hardcode thresholds or timeouts |
| Reload relevant domain after push | Add new automations that affect other domains | Guess entity IDs |
| Update `docs/system-*.md` after any change | Delete or rename automations | Use `continue_on_error: true` to hide failures |

## Critical Rules

1. **Diagnose root causes before touching anything.** Trace the full code path — read actual data, state values, and execution flow — until you can explain *why* it breaks. Only then fix the cause, not the symptom. Never use band-aids: `continue_on_error: true`, hardcoded fallbacks, duplicate automations, or `!important`/z-index hacks.

2. **Never assume — read or ask first.** Before writing code that touches an existing file, read it. Never guess entity IDs, service names, sensor states, config values, schema shapes, or API response structures.

3. **Never hardcode configurable values.** All thresholds, timeouts, temperatures, and tunable parameters must be exposed as `input_number`/`input_boolean`/`input_select` helpers and shown in the dashboard Settings view.

## Before Making Changes

1. Read `docs/system-*.md` for the relevant domain before modifying automations or config. These describe hardware, sensors, entity names, and design decisions.
2. Read `docs/house-rules.md` for behavioral patterns and physical constraints.
3. Consult the [Home Assistant docs](https://www.home-assistant.io/docs/) — HA updates frequently.

## Project Structure

- `config/` — Home Assistant configuration files (synced from HA instance)
  - `automations/` — Split automation files by domain
  - `scripts/` — Split script files
  - `configuration.yaml` — Main config, input helpers, template sensors
- `dashboard/` — React 19 + TypeScript custom panel (Vite, see `dashboard/CLAUDE.md`)
- `docs/` — System documentation and plans
  - `system-*.md` — Describes what IS (hardware, entities, design decisions)
  - `house-rules.md` — Behavioral patterns, routines, physical constraints
- `tools/` — Validation scripts
- `docs/templates/` — YAML automation templates and domain-specific dashboard card templates
  - **Templates live here, not in `config/`.** `make pull` runs rsync `--delete`, which removes any files in `config/` that don't exist on the remote HA instance. The setup-customize skill copies and adapts templates into `config/` after `make pull` has run.

## Rsync Architecture

Two separate exclude files for different sync directions:

| File | Used By | Purpose |
|------|---------|---------|
| `.rsync-excludes-pull` | `make pull` | Less restrictive — syncs `.storage/` for local reference |
| `.rsync-excludes-push` | `make push` | More restrictive — never overwrites HA runtime state |

**Never push `.storage/`** — it is managed by HA at runtime. Local modifications are ignored or overwritten.

## Workflow Rules

### Before `make push`
1. Run `make pull` to ensure local files are current
   - **Warning:** `make pull` uses rsync `--delete`. Do NOT run it if you have local template copies or generated files that don't exist on the remote HA instance yet — they will be deleted.
2. Validation runs automatically — do not push if validation fails
3. Only YAML configuration files are synced (`.storage/` is protected)

### After `make push`
1. Reload the relevant HA components (`automation/reload`, `script/reload`, etc.)
2. Verify changes took effect in HA
3. Update `docs/system-*.md` to reflect any changes
4. Commit your work

## Automation Patterns (Mandatory)

### Motion Light Off

Always use the **motion sensor `to: 'off'` + `for:`** pattern. Never use `delay`, `wait_for_trigger`, or separate timers.

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.ROOM_motion_sensor
    to: 'off'
    for:
      seconds: >
        {% if is_state('input_boolean.night_mode', 'on') %}
          {{ states('input_number.timeout_motion_night') | int(30) }}
        {% else %}
          {{ states('input_number.timeout_motion_normal') | int(120) }}
        {% endif %}
```

## Available Commands

```bash
make pull              # Pull latest config from Home Assistant
make push              # Push local config to HA (with validation)
make diff              # Preview what push would sync (dry run)
make validate          # Run all validation tests
make reload            # Reload HA configuration via API
make backup            # Create timestamped backup
make setup             # Set up Python environment
make entities          # Explore available entities
make dashboard         # Start dashboard dev server
make deploy-dashboard  # Build and deploy dashboard to HA
```

### ha-api / ha-ws (on HA via SSH — preferred)

[claude-code-ha](https://github.com/danbuhler/claude-code-ha) tools installed on the HA instance. Access via SSH:

```bash
# REST API (fast, simple queries)
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api state sensor.entity_name"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api domains"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api search kitchen"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-api call automation reload"

# WebSocket API (registry, entity rename, detailed lookups)
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws entity list climate"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws entity get sensor.foo"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws entity update sensor.old new_entity_id=sensor.new"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws area list"
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws device list"
```

`ha-ws entity get` shows registry info, current state, device, area, AND related automations — the most comprehensive entity lookup available.

Automation traces:

```bash
ssh "$SSH_USER@$HA_HOST" "source /etc/profile.d/claude-ha.sh; source ${HA_REMOTE_PATH:=/config/}.env; ha-ws raw trace/list domain=automation item_id=AUTOMATION_ID"
```

**Installation** (one-time, on the HA instance):
```bash
ssh "$SSH_USER@$HA_HOST" "cd ${HA_REMOTE_PATH:=/config/} && git clone https://github.com/danbuhler/claude-code-ha.git && bash ${HA_REMOTE_PATH}claude-code-ha/install.sh"
```

**After HA OS updates:** HA OS resets the root filesystem, wiping symlinks and installed packages. Re-run the install script:
```bash
ssh "$SSH_USER@$HA_HOST" "bash ${HA_REMOTE_PATH:=/config/}claude-code-ha/install.sh"
```
The repo itself persists in `/config/claude-code-ha/` (survives updates), only the symlinks and pip packages need reinstalling.


## Debugging Automation Issues

When an automation appears to have not fired or behaved unexpectedly:

1. **Check the HA UI Traces tab first** — Settings > Automations > [name] > Traces. This is the authoritative source.
2. **Check entity state history** — `GET /api/history/period/TIMESTAMP?filter_entity_id=ENTITY`
3. **Test templates live** — `POST /api/template` with `{"template": "..."}`

### What does NOT work (do not attempt)

- **HA REST API for automation traces** — the endpoint does not exist (returns 404). Traces are WebSocket-only or via the HA UI.
- **`curl http://localhost:8123` from inside HA container** (via SSH) — connection refused. HA's HTTP server binds to the host network.
- **`sqlite3` inside HA container** — not installed on HA OS.
- **`.storage/trace.saved_traces`** — only persists traces for automations stopped by a failed condition. Absence does NOT mean it didn't run.

## Validation System

- **Post-Edit Hook**: Runs after editing any YAML in `config/`
- **Pre-Push Hook**: Blocks `make push` if validation fails
- Template placeholder IDs (`sensor.your_*`) are skipped during validation

## Entity Naming Convention

Format: `location_room_device_sensor` (e.g., `sensor.kitchen_motion_battery`)

- Always verify entity IDs via `docs/system-*.md` or `make entities`
- Never guess entity IDs — ask the user if uncertain

## Dashboard Deployment

- Always use `make deploy-dashboard` (NOT raw rsync — it handles `panel.js` separately)
- `panel_custom` `module_url` does NOT support query params — use content hashes for cache busting
- iOS WKWebView has no `MediaSource` API — use WebRTC for mobile camera streams
- See `dashboard/CLAUDE.md` for full dashboard development guide

## Important Notes

- Use `gh` CLI for GitHub content — not `WebFetch`/`curl` (avoids rate limiting)
- Blueprint files use `!input` tags — normal and expected
- Secrets are skipped during validation
- SSH access required for pull/push operations
- Python venv required for validation tools (`make setup`)
