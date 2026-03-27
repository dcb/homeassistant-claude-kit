---
title: last_triggered is unreliable for cooldown/deduplication logic
category: automation-issues
date: 2026-03-26
tags: [last_triggered, cooldown, deduplication, timing]
---

# last_triggered is unreliable for cooldown/deduplication logic

## Problem

A cooldown condition like this always passes, defeating deduplication:

```yaml
conditions:
  - condition: template
    value_template: >
      {{ (now() - state_attr('automation.my_automation', 'last_triggered'))
         > timedelta(minutes=30) }}
```

Notifications or actions fire every time the trigger matches, ignoring the
intended 30-minute cooldown window.

## Root Cause

Home Assistant updates `last_triggered` **before** conditions are evaluated.
By the time the template runs, `last_triggered` is already set to the current
time, so the delta is always approximately zero -- which is never greater than
30 minutes. The condition always evaluates to `false` (or `true`, depending on
the comparison direction), but never reflects the actual gap between firings.

## Solution

Use a `timer` helper or a `trigger`-based template sensor to track cooldown
state explicitly.

**Timer approach:**

```yaml
# In configuration.yaml
timer:
  battery_alert_cooldown:
    duration: "00:30:00"

# In the automation
conditions:
  - condition: state
    entity_id: timer.battery_alert_cooldown
    state: "idle"
actions:
  - action: timer.start
    target:
      entity_id: timer.battery_alert_cooldown
  - action: notify.mobile_app
    data:
      message: "Battery low"
```

**Trigger-based template sensor approach:**

```yaml
template:
  - trigger:
      - trigger: event
        event_type: my_alert_fired
    sensor:
      - name: "Last alert fired"
        state: "{{ now().isoformat() }}"
```

Then check `(now() - states('sensor.last_alert_fired') | as_datetime) > timedelta(...)`.

## Prevention

Never use `last_triggered` in condition templates. When you need cooldown or
deduplication, always use an external state tracker (timer, input_datetime, or
trigger-based template sensor) that you control explicitly.
