---
title: 'Extend last data point to "now" for today''s chart view'
category: dashboard-issues
date: 2026-03-26
tags: [charts, history, real-time, uplot]
---

# Extend last data point to "now" for today's chart view

## Problem

Chart lines stop at the last recorded value change even though the sensor is
online and reporting. For a temperature sensor holding steady at 22.0 since
10:00 AM, the chart line ends at 10:00 AM and the rest of the day is blank.
Users interpret this as missing data or a sensor failure.

## Root Cause

The `history/stream` API only emits entries when the state or attributes change.
A sensor reporting a constant value produces no new history points. The chart
faithfully plots only the data it receives, so the line ends at the last
transition.

## Solution

When rendering today's data, append a synthetic point that extends the last
known value to the current time:

```ts
if (isToday && data.length > 0) {
  const lastPoint = data[data.length - 1];
  data.push([Date.now(), lastPoint[1]]);
}
```

This works because:
- The sensor is still reporting -- the value just hasn't changed.
- Component re-renders triggered by other WebSocket updates (or a periodic
  tick) naturally advance `Date.now()`, keeping the endpoint current.
- For historical (non-today) views, do not add this point -- the data is
  complete.

Only apply this to the current day's view. For past dates, the history is
already closed and the last point represents the actual last known value for
that period.

## Prevention

- Treat "extend to now" as a standard chart rendering step, not an afterthought.
- Only apply to live/today views -- never mutate historical data.
- If the last entry has state `unavailable` or `unknown`, do NOT extend it --
  that would misrepresent a genuine outage.
