---
title: "History stream: always use lu (last_updated), never lc (last_changed) for charts"
category: dashboard-issues
date: 2026-03-26
tags: [history-stream, timestamps, charts, last_updated, last_changed]
---

# History stream: always use lu (last_updated), never lc (last_changed) for charts

## Problem

Chart lines stop mid-day or show flat gaps even though the sensor was reporting.
Heating timelines display wrong durations, sometimes showing hours of "idle"
when the boiler was actually cycling.

## Root Cause

Home Assistant's compressed history stream uses two timestamp fields:

- **`lu`** (last_updated) -- updated every time HA records a state object,
  including attribute-only changes.
- **`lc`** (last_changed) -- updated only when the *main state value* changes.

Temperature sensors that report the same value (e.g., 21.5 for two hours)
will share a single `lc` timestamp across many entries. Using `lc` for chart
X-axis positioning collapses all those points to one spot, breaking the
timeline.

For climate entities, `hvac_action` changes (heating/idle) are attribute
changes that update `lu` but not `lc`.

## Solution

Always use `entry.lu * 1000` (converting seconds to milliseconds) for chart
point positioning:

```ts
const timestamp = (entry.lu ?? entry.lc) * 1000;
```

Reserve `lc` only for detecting actual *value* transitions (e.g., highlighting
when a temperature changed). Never use it for X-axis placement.

## Prevention

- Establish a project convention: `lu` for positioning, `lc` for change
  detection.
- Name variables clearly: `pointTime` from `lu`, `valueChangedAt` from `lc`.
- When debugging chart gaps, first check which timestamp field is being used
  before investigating data availability.
