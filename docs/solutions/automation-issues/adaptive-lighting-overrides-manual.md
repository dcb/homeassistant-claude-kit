---
title: "Adaptive Lighting overrides manual light commands within seconds"
category: automation-issues
date: 2026-03-26
tags: [adaptive-lighting, manual-control, light, override]
---

# Adaptive Lighting overrides manual light commands within seconds

## Problem

After manually setting a light's brightness or turning it off, the light
reverts to Adaptive Lighting (AL) values within seconds. Manual control
appears to be ignored.

## Root Cause

Adaptive Lighting runs on an approximately 90-second cycle, continuously
pushing brightness and color temperature to managed lights. Even in "sleep
mode," AL still actively pushes sleep-mode values.

When you call `light.turn_off` or `light.turn_on` with a specific brightness,
AL detects the state but then overwrites it on its next cycle. The
`detect_non_ha_changes` and manual control detection features do not catch
changes made by other HA automations — they only detect changes from physical
switches or external apps.

## Solution

Disable the **main AL switch** before setting manual light states, then
re-enable it after cleanup:

```yaml
# 1. Disable AL for the zone
- action: switch.turn_off
  target:
    entity_id: switch.adaptive_lighting_bedroom

# 2. Now set the light state (AL won't override)
- action: light.turn_off
  target:
    entity_id: light.bedroom_ceiling

# 3. Re-enable AL later (e.g., on next motion trigger or schedule)
- action: switch.turn_on
  target:
    entity_id: switch.adaptive_lighting_bedroom
```

Key points:
- Turning off `switch.adaptive_lighting_sleep_mode_<zone>` is **not enough**
  — the main AL switch continues pushing non-sleep values.
- The main switch is `switch.adaptive_lighting_<zone>`, not the sleep mode
  or adapt-brightness sub-switches.
- Re-enable AL in a cleanup trigger or timed follow-up, not in the same
  action sequence (or AL will immediately re-override).

## Prevention

- Any automation that needs to set manual light values in an AL-managed zone
  must disable AL first.
- Document which zones are AL-managed so automation authors know to account
  for it.
- Test manual light automations by checking the light state 2 minutes after
  the action runs, not immediately.
