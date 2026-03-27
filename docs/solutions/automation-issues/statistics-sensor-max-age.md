---
title: "statistics sensor max_age must exceed source polling interval"
category: automation-issues
date: 2026-03-26
tags: [statistics, sensor, polling, max_age, rolling-mean]
---

# statistics sensor max_age must exceed source polling interval

## Problem

A `statistics` platform sensor configured with a rolling mean stays `unknown`
indefinitely. Developer tools show `buffer_usage_ratio: 0.0` — the buffer
never accumulates any samples.

## Root Cause

The `max_age` window (e.g. 2 minutes) was shorter than the source sensor's
polling interval (e.g. 5 minutes). Each sample expired from the buffer before
the next one arrived, so the statistics sensor never had enough data to compute
a value.

## Solution

1. Set `max_age` to **2-3x the source sensor's polling interval**.
   For a source that polls every 5 minutes, use `max_age: { minutes: 15 }`.

2. The source sensor **must** have `state_class: measurement`. Without it,
   the statistics platform ignores the entity entirely.

3. After changing `max_age`, a **full Home Assistant restart** is required.
   A YAML reload is not sufficient for statistics platform changes.

4. Be aware that `make push` followed by a reload will temporarily wipe the
   in-memory sample buffer. The sensor will return to `unknown` until enough
   new samples accumulate within the configured window.

```yaml
# Example: source polls every 5 minutes
sensor:
  - platform: statistics
    name: "Power rolling mean"
    entity_id: sensor.grid_power
    state_characteristic: mean
    max_age:
      minutes: 15    # 3x the 5-min poll interval
    sampling_size: 20
```

## Prevention

- Always check the source sensor's `update_interval` or poll frequency before
  setting `max_age`.
- After deploying a new statistics sensor, monitor `buffer_usage_ratio` in
  Developer Tools > States to confirm samples are accumulating.
