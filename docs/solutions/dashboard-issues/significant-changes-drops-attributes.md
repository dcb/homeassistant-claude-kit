---
title: "significant_changes_only drops attribute-level transitions"
category: dashboard-issues
date: 2026-03-26
tags: [history-stream, significant_changes_only, attributes, hvac_action]
---

# significant_changes_only drops attribute-level transitions

## Problem

Boiler heating/idle transitions are not visible in timeline views. The history
data only contains a handful of points per day even though the boiler cycles
frequently. Other attribute-tracked state changes (e.g., fan speed, brightness)
are similarly missing.

## Root Cause

The `history/stream` WebSocket subscription accepts a `significant_changes_only`
flag. When set to `true`, Home Assistant filters the stream to only include
entries where the **main state value** changed. Attribute-only changes are
silently dropped.

For climate entities, the main state is typically "heat" or "off" and rarely
changes. The useful cycling information lives in the `hvac_action` attribute
(heating/idle), which is an attribute-only change and gets filtered out.

## Solution

Use `significant_changes_only: false` when the visualization depends on
attribute changes:

```ts
const sub = await connection.subscribeMessage(callback, {
  type: "history/stream",
  entity_ids: ["climate.living_room"],
  significant_changes_only: false,  // need attribute changes
  minimal_response: true,           // still reduce payload size
  no_attributes: false,             // need attributes in response
});
```

Pair with `minimal_response: true` to keep payload sizes reasonable. Only
request `no_attributes: false` for entities where you actually need attribute
data.

## Prevention

- Default to `significant_changes_only: false` for any history subscription
  that renders timelines or charts based on attributes.
- Document which entities rely on attribute tracking vs. state tracking.
- When a timeline looks sparse, check the subscription flags before assuming
  the entity isn't reporting.
