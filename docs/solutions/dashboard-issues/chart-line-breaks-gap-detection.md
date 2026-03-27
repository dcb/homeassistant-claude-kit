---
title: "Chart line breaks from time-based gap detection heuristic"
category: dashboard-issues
date: 2026-03-26
tags: [charts, gap-detection, zigbee, availability]
---

# Chart line breaks from time-based gap detection heuristic

## Problem

Chart lines break unexpectedly at schedule transitions or during quiet periods,
even though the sensor was online the entire time. Zigbee temperature sensors
are particularly affected, showing fragmented lines throughout the day.

## Root Cause

A naive gap-detection heuristic that breaks the line whenever two consecutive
data points are more than N minutes apart (e.g., 15 minutes). Zigbee sensors
report at variable intervals -- typically every 10-30 minutes depending on
value change and device configuration. A sensor holding steady at 21.5 might
not report for 25 minutes, exceeding the 15-minute threshold and producing
a false line break.

The heuristic conflates "no data received" with "sensor was offline," but
these are fundamentally different conditions.

## Solution

Use actual sensor availability transitions instead of time gaps:

```ts
// Break line only on genuine unavailability
const shouldBreak =
  entry.s === "unavailable" || entry.s === "unknown";
```

If you still need implicit gap detection (e.g., for sensors that silently
disappear without an `unavailable` transition), use a much wider bracket:

```ts
const GAP_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes
const gap = points[i].time - points[i - 1].time;
if (gap > GAP_THRESHOLD_MS) {
  // insert null to break the line
}
```

45 minutes accommodates Zigbee's worst-case reporting interval with margin.
For WiFi sensors that report every 30-60 seconds, you could use a tighter
threshold, but a single generous value is simpler and avoids false breaks.

## Prevention

- Never use a flat time threshold under 30 minutes for Zigbee sensors.
- Prefer explicit availability checks (`unavailable`/`unknown` states) over
  time-based heuristics.
- When adding gap detection, test with real Zigbee history data that includes
  long stable-value periods.
