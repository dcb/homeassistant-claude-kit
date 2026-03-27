---
title: "continue_on_error: true - legitimate use for cloud API sequences"
category: automation-issues
date: 2026-03-26
tags: [continue_on_error, cloud-api, error-handling, tesla]
---

# continue_on_error: true - legitimate use for cloud API sequences

## Problem

A multi-step automation that sends commands to a cloud API (e.g., Tesla,
smart EV chargers) aborts entirely when the first preparatory API call fails.
The device may be asleep or temporarily unreachable, returning a 500 error.
The critical subsequent step (e.g., `switch.turn_on`) never executes.

## Root Cause

Home Assistant aborts the remaining action sequence when any step returns an
error. In cloud API sequences, preparatory steps like `number.set_value` (set
charging amps) may fail because the device is asleep, but the critical follow-up
step (`switch.turn_on` to start charging) would actually wake the device and
succeed.

This is distinct from using `continue_on_error` as a band-aid to hide bugs.
Here, the failed step is genuinely non-critical and non-retryable in the
moment, and blocking on it prevents the critical action from running.

## Solution

Add `continue_on_error: true` on **non-critical preparatory steps** that
precede critical ones:

```yaml
actions:
  # Preparatory: set amps (may fail if car is asleep — that's OK,
  # the car will use its last-known amp setting)
  - action: number.set_value
    target:
      entity_id: number.your_ev_charging_amps
    data:
      value: "{{ charging_amps }}"
    continue_on_error: true

  # Critical: actually start charging (this wakes the car)
  - action: switch.turn_on
    target:
      entity_id: switch.your_ev_charger
```

### When this is legitimate

- The failed step is **preparatory**, not the primary action.
- The failed step sets a parameter that has a sensible default or last-known
  value on the device.
- The critical step that follows would succeed independently.
- Retrying the failed step inline would add complexity without benefit.

### When this is a band-aid (do NOT use)

- The failed step IS the critical action and you're hiding the failure.
- The error indicates a logic bug (wrong entity, bad template).
- You haven't investigated why the step fails.

## Prevention

- Document why each `continue_on_error: true` is present with a YAML comment.
- Limit its use to cloud API sequences where device availability is uncertain.
- Log or notify on failure so issues are visible even when execution continues.
