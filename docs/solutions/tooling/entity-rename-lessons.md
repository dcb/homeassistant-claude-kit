---
title: "Entity Rename: Lessons from 452 renames across 8 batches"
category: tooling
date: 2026-03-26
tags: [entity-rename, home-assistant, websocket, yaml, adaptive-lighting]
severity: high
symptoms:
  - Broken automations after entity rename (silent failures)
  - Missing child entity renames causing runtime crashes
  - Double renames from mid-flight naming corrections
  - Adaptive Lighting zones not updating after entity rename
root_cause: >
  HA does NOT auto-update automations, scripts, scenes, or dashboards when
  entities are renamed. YAML references break silently. .storage/ configs
  (AL zones, Lovelace) must be patched separately.
---

# Entity Rename Lessons

Extracted from 452 entity renames across 8 batches (March 11-12, 2026) on
a production HA instance. These lessons inform the `entity-rename` skill.

## API Method: WebSocket ONLY

**REST API does NOT work for entity renames.** All REST endpoints return 404:
- `POST /api/config/entity_registry/{entity_id}` -- 404
- `PUT /api/config/entity_registry/{entity_id}` -- 404
- `PATCH /api/config/entity_registry/{entity_id}` -- 404

The only working method is the WebSocket API:

```json
{
  "type": "config/entity_registry/update",
  "entity_id": "sensor.old_name",
  "new_entity_id": "sensor.new_name"
}
```

**Simplest tool:** `ha-ws` from [claude-code-ha](https://github.com/danbuhler/claude-code-ha), runs on the HA instance via SSH:

```bash
ssh $HA_HOST "source /etc/profile.d/claude-ha.sh; source /config/.env; ha-ws entity update sensor.old_name new_entity_id=sensor.new_name"
```

## What Gets Auto-Updated (and What Doesn't)

| Component | Auto-updated? | Action needed |
|-----------|--------------|---------------|
| Recorder / history | Yes | None |
| Long-term statistics | Yes | None |
| YAML automations | **No** | Edit locally + `make push` |
| UI automations | **No** | Break silently |
| Scripts | **No** | Edit locally + `make push` |
| Scenes | **No** | Break silently |
| Dashboards / Lovelace | **No** | Edit `.storage/` on HA via SSH |
| Adaptive Lighting zones | **No** | Edit `.storage/` on HA via SSH + **restart HA** |
| Dashboard `entities.ts` | **No** | Edit locally + rebuild |
| Python scripts | **No** | Edit locally + `make push` |

## 12 Safety Rules

### 1. Finalize ALL names before starting
Naming corrections mid-flight caused double renames. In Batch 1, `light.balcony_lamp` was renamed to `light.balcony_main` after realizing `_lamp` was reserved for floor lamps only. Lock down the descriptor vocabulary BEFORE executing.

### 2. Enumerate ALL child entities per device
Missing `number.hallway_radiator_local_temperature_calibration` caused a runtime crash in `update_zone_climate` (accessing `states[]` on a missing entity). When renaming a parent entity, ALWAYS list all child entities (battery, calibration, heating, window_detection, etc.) and rename them too.

### 3. Check target entity_id doesn't already exist
HA rejects renames to entity_ids that already exist. Some entities (e.g., tumble dryer) already had renamed duplicates. Always verify the target is available before each rename.

### 4. Two-step renames for name collisions
When a bulb holds a name that should belong to a room group (e.g., `light.kitchen` is a bulb but should be the group), rename in two steps:
1. `light.kitchen` -> `light.kitchen_main` (frees the name)
2. `light.kitchen_group` -> `light.kitchen` (takes the freed name)

Order is critical: blocker first, then the entity that takes the freed name.

### 5. After each batch: pull, validate, grep
After every batch:
1. `make pull` -- sync the updated entity registry locally
2. `make validate` -- check for broken references
3. `grep` for ALL old entity names across config/ and dashboard/

### 6. Don't trust parallel agents for YAML updates
Background agents failed to complete YAML reference updates on 3 of 7 batches. Climate entities with ~88 references were particularly problematic. Always validate after every batch.

### 7. Update .storage files on HA directly
Adaptive Lighting zones and Lovelace dashboards store entity IDs in `.storage/` files that cannot be pushed via `make push`. Edit on HA via SSH using Python JSON manipulation scripts.

### 8. Restart HA after Adaptive Lighting zone changes
Reloading the AL integration is NOT sufficient after patching `.storage/core.config_entries`. A full HA restart is required.

### 9. Maintain tracking JSON
The rename session ran across 4+ context continuations. The `entity-renames.json` tracker was the only reliable source of truth for what had been completed. Essential for multi-session work.

### 10. Back up .storage files before editing
Always create `.bak` copies via SSH before modifying `.storage/` files: `cp file file.bak`

### 11. HA does NOT auto-update any references
This is the single most important lesson. Renames are entity-registry-only operations. Every YAML file, dashboard config, script, and integration config that references the old entity ID will break silently.

### 12. Recorder/statistics DO auto-migrate
History data and long-term statistics follow the rename automatically. No action needed for historical data preservation.

## Batching Strategy That Worked

| Batch | What | Count | Key Lesson |
|-------|------|-------|------------|
| 0 | YAML-only fixes (already renamed on HA) | 0 | Fix broken refs first |
| 1 + 1b | Hue bulbs + corrections | 9 | Finalize names BEFORE executing |
| 2 | Misleading names (stairs, toilet) | 10 | Watch for name collisions |
| 3 | Climate serial numbers | 17 | Highest ref count (~88) |
| 4 | Light consistency + radiators | 32 | Two-step renames |
| 5 | Switches / dials / batteries | 55 | Battery sensor collisions |
| 6 | Cameras (localized -> English) | 326 | Bulk prefix replacement |
| 7 | Media players, miscellaneous | 3 | Check for existing duplicates |

## Locations That Need Updating (Complete Checklist)

After each rename, check ALL of these:

- [ ] `config/automations/*.yaml`
- [ ] `config/scripts/*.yaml` + `scripts.yaml`
- [ ] `config/configuration.yaml` (helpers, templates)
- [ ] `config/automations.yaml` (legacy)
- [ ] `dashboard/src/lib/entities.ts`
- [ ] `dashboard/src/lib/areas.ts`
- [ ] `config/custom_scripts/*.py`
- [ ] `.storage/core.config_entries` (Adaptive Lighting zones) -- on HA via SSH
- [ ] `.storage/lovelace.*` (dashboards) -- on HA via SSH
- [ ] Snapshot folders (`/media/snapshots/`) -- rename + symlinks for history
- [ ] Run `make pull` to sync updated `.storage/core.entity_registry`
