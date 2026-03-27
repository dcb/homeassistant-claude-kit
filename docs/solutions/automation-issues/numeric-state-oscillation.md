---
title: numeric_state fires on every threshold crossing including oscillation
category: automation-issues
date: 2026-03-26
tags: [numeric_state, oscillation, notifications, battery]
---

# numeric_state fires on every threshold crossing including oscillation

## Problem

Battery low notifications are sent repeatedly for the same device, even though
the battery level barely changes. A sensor oscillating between 19% and 20%
generates a new notification on every downward crossing.

```yaml
triggers:
  - trigger: numeric_state
    entity_id: sensor.door_lock_battery
    below: 20
```

## Root Cause

`numeric_state below: 20` fires on **every** crossing from >= 20 to < 20.
A sensor fluctuating around the threshold (20 -> 19 -> 20 -> 19) triggers the
automation twice. This is by design -- HA re-arms the trigger each time the
value crosses back above the threshold.

## Solution

**Option A: Track notification state per entity.**

Use an `input_text` or `input_boolean` helper to record that a notification was
already sent for a given entity, and reset it when the battery recovers.

**Option B: Use `above:` to constrain the previous state.**

```yaml
triggers:
  - trigger: numeric_state
    entity_id: sensor.door_lock_battery
    below: 15
conditions:
  - condition: numeric_state
    entity_id: sensor.door_lock_battery
    above: 10  # ignore deep-discharge noise
```

**Option C: Add a `for:` duration to filter transient dips.**

```yaml
triggers:
  - trigger: numeric_state
    entity_id: sensor.door_lock_battery
    below: 20
    for:
      minutes: 30
```

This ensures the value stays below the threshold for 30 minutes before firing,
filtering out brief oscillations.

## Prevention

For any `numeric_state` trigger on a noisy sensor, always add either a `for:`
duration to debounce transient crossings, or a notification-tracking mechanism
to avoid repeated alerts for the same condition.
