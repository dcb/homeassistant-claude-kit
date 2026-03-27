---
title: "Watchdog bare `to:` trigger causes integration reload loop"
category: logic-errors
date: 2026-03-16
tags: [watchdog, trigger, flapping, reload_config_entry]
---

## Problem

An integration watchdog automation causes flapping every 3 minutes: sensors cycling `unavailable` (1s) then back to a valid value (3 min) then `unavailable` (1s), producing a notification every 3 minutes. The sensors never stayed down long enough for the user to notice an outage, but the phone was flooded with alerts.

## Root Cause

The watchdog trigger used a bare `to:` (null value):

```yaml
triggers:
- trigger: state
  entity_id:
  - sensor.your_monitored_sensor
  to:        # <-- null = matches ANY state change
  for:
    minutes: 3
```

In Home Assistant, `to:` with no value matches **every state transition**. Combined with `for: minutes: 3`, this fires when any new state persists for 3 minutes -- including valid temperature values.

The reload loop:
1. Integration goes genuinely unavailable
2. Watchdog fires after 3 min, calls `reload_config_entry`
3. Reload briefly sets entities to `unavailable` (~1s) then recovers
4. Recovery is a new state transition -> 3-min timer restarts
5. After 3 min of valid data, trigger fires again
6. Condition `trigger.to_state.state in ['unavailable', 'unknown']` may pass depending on HA's evaluation timing during the reload's brief unavailable blip
7. Goto 3 -- infinite loop

## Solution

Replace bare `to:` with explicit target states:

```yaml
triggers:
- trigger: state
  entity_id:
  - sensor.your_monitored_sensor
  - sensor.your_second_sensor
  to: unavailable
  for:
    minutes: 1
  id: state_change
- trigger: state
  entity_id:
  - sensor.your_monitored_sensor
  - sensor.your_second_sensor
  to: unknown
  for:
    minutes: 1
  id: state_change
```

This ensures the `for:` timer only starts when the sensor is actually in a bad state. The brief 1-second unavailable blip from `reload_config_entry` never reaches the 1-minute threshold.

## Verification

Disabled watchdog -> flapping stopped immediately (sensor updated cleanly at normal intervals). Re-enabled with fix -> no more flapping.

## Prevention

- **Never use bare `to:` in watchdog triggers.** Always specify the exact state(s) to watch for.
- When writing `to:` + `for:` triggers, ask: "will my remediation action create a state transition that re-arms this trigger?"
- If you need to watch for multiple bad states, use separate trigger entries with explicit `to:` values rather than a single bare `to:` with condition filtering.

## Related

- [ha-watchdog-state-coverage-gaps](ha-watchdog-state-coverage-gaps.md) -- complementary issue about watchdogs not covering `unknown` state and startup races
- [watchdog-single-shot-reload-failure](watchdog-single-shot-reload-failure.md) -- watchdog fires correctly but gives up after one reload attempt
