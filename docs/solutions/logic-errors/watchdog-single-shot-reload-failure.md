---
title: "Watchdog automation silent recovery failure: single-shot reload gives up too early"
category: logic-errors
date: 2026-03-26
tags:
  - watchdog
  - automation-traces
  - integration-restart
  - debugging-toolchain
  - repeat-until
symptom: >
  Watchdog automation fired and sent a "Down" notification, but the integration
  remained unavailable for hours until manually restarted from the HA UI.
root_cause: >
  The watchdog made a single reload attempt and checked recovery after 30 seconds.
  The integration's connection was still unreachable at that point (device hadn't
  recovered yet), so the reload appeared to fail. With no retry logic, the automation
  stopped -- the integration eventually became reachable but nothing triggered the
  reload again since there was no further state transition.
---

## Problem

An integration went unavailable at 16:56 UTC. The watchdog fired correctly
at 16:56:49, called `homeassistant.reload_config_entry`, waited 30 seconds, found
entities still unavailable, and sent a "Down" notification. Then it
stopped. The integration stayed down until manually restarted ~3 hours later.

The automation worked as designed -- but the design was wrong. One reload attempt with
a 30-second recovery window is insufficient for integrations that reconnect slowly.

## Investigation

### What failed during debugging (dead ends to avoid)

**HA REST API for automation traces** (`/api/config/automation/config/{id}/traces`)
-- returns 404. This endpoint does not exist. Automation traces are only accessible
via the WebSocket API or the HA UI. Do not guess REST endpoints for trace data.

**SSH into HA container -> `curl http://localhost:8123`** -- connection refused.
HA's HTTP server binds to the host network interface, not the container's loopback.
Queries to `localhost` from inside `ha core shell` won't reach HA's HTTP.

**SSH -> `sqlite3`** -- command not found. The HA OS base container does not include
sqlite3. The recorder DB (`/config/home-assistant_v2.db`) is accessible from the
host OS only.

**`.storage/trace.saved_traces` file** -- only contained one unrelated entry.
This file is not a full execution log. It only persists traces for automations that
stopped due to a **failed condition** -- not successful runs or action errors.
Absence of a record here does NOT mean the automation didn't run.

### What worked

**HA UI Traces tab** -- Settings -> Automations -> [name] -> Traces. This is the
authoritative and fastest source. Showed the automation fired, executed
all steps, and sent the notification correctly.

**HA REST API via external URL** (`http://homeassistant.local:8123`) with Bearer
token -- works reliably from outside the container for `/api/states`, `/api/history/period`,
and `/api/template`.

**`POST /api/template`** -- confirmed `config_entry_id('sensor.your_monitored_sensor')`
returns a valid entry ID, ruling out template failure.

**State history** (`/api/history/period`) -- confirmed the entity went `unavailable`
at 16:56 UTC and recovered at 19:42 UTC when manually restarted.

## Root Cause

The automation worked correctly as a one-shot mechanism. The integration reload was
called but the device's connection wasn't re-established within 30 seconds
(the device itself needed more time). After notifying, the automation exited. Since
the entity stayed `unavailable` with no further state transition, the `state` trigger
never fired again.

## Solution

Replace the single reload + 30s check with a `repeat: until` retry loop:

```yaml
# Before: single shot
- action: homeassistant.reload_config_entry
  data:
    entry_id: "{{ config_entry_id(trigger.entity_id) }}"
- delay:
    seconds: 30
- if:
  - condition: template
    value_template: "{{ states('sensor.your_monitored_sensor') in ['unavailable', 'unknown'] }}"
  then:
  - action: notify.your_notify_service
    data:
      title: Integration Down
      message: Watchdog reload failed. Still down.

# After: retry loop -- every 2 min, up to 30x (1 hour max)
- repeat:
    until:
      - condition: template
        value_template: >
          {{ not (states('sensor.your_monitored_sensor') in ['unavailable', 'unknown']
             or states('sensor.your_second_sensor') in ['unavailable', 'unknown'])
             or repeat.index >= 30 }}
    sequence:
    - action: homeassistant.reload_config_entry
      data:
        entry_id: >
          {% if trigger.id == 'startup' %}
            {{ config_entry_id('sensor.your_monitored_sensor') }}
          {% else %}
            {{ config_entry_id(trigger.entity_id) }}
          {% endif %}
    - delay:
        minutes: 2
- if:
  - condition: template
    value_template: >
      {{ states('sensor.your_monitored_sensor') in ['unavailable', 'unknown']
         or states('sensor.your_second_sensor') in ['unavailable', 'unknown'] }}
  then:
  - action: notify.your_notify_service
    data:
      title: Integration Down
      message: Watchdog gave up after 30 reload attempts. Still down.
  else:
  - action: notify.your_notify_service
    data:
      title: Integration Auto-Fixed
      message: "{{ trigger.to_state.name }} was down -- reloaded successfully."
```

Apply the same pattern to all watchdog automations.

## Debugging Checklist for HA Automation Issues

1. **HA UI Traces tab first** -- Settings -> Automations -> [name] -> Traces. Fastest path to ground truth.
2. **Read trigger, conditions, actions** in the trace end-to-end. Find where it stopped.
3. **Check entity history** -- Developer Tools -> History, or `GET /api/history/period` -- confirm the triggering state change actually occurred.
4. **Test conditions live** -- Developer Tools -> Template editor.
5. **Test service calls manually** -- Developer Tools -> Services.
6. **Check HA logs** for template errors or service call failures around the relevant time.

## Key Facts

| Topic | Fact |
| ----- | ---- |
| Automation traces | HA UI only: Settings -> Automations -> [name] -> Traces. WebSocket API: `trace/list` + `trace/get`. **No REST endpoint.** |
| `.storage/trace.saved_traces` | Only persists traces for automations stopped by a **failed condition**. Not a full execution log. |
| HA HTTP from inside container | `localhost:8123` is refused. HA binds to the host network. Use `homeassistant.local` from outside. |
| `sqlite3` in HA container | Not installed. Recorder DB at `/config/home-assistant_v2.db` is accessible from the host OS only. |
| REST API scope | States, services, events, config entries, history. **No trace endpoint.** |
| Watchdog retry pattern | Use `repeat: until` with a cap (30 x 2 min = 1 hour) so transient failures get retried. |

## Related

- [ha-watchdog-state-coverage-gaps](ha-watchdog-state-coverage-gaps.md) -- watchdogs missing `unknown` state and startup races
- [watchdog-bare-to-trigger-flapping](watchdog-bare-to-trigger-flapping.md) -- bare `to:` trigger causing reload loops
