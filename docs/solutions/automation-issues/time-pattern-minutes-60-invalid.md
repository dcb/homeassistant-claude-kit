---
title: "time_pattern trigger minutes: \"/60\" is invalid"
category: automation-issues
date: 2026-03-26
tags: [time_pattern, trigger, validation, cron]
---

# time_pattern trigger minutes: "/60" is invalid

## Problem

An automation fails to set up with the error:
`must be a value between 0 and 59`

The automation never runs and appears as unavailable in the UI.

## Root Cause

The `time_pattern` trigger's `minutes` field only accepts values in the range
0-59 (or patterns like `/5`, `/15` that divide evenly into the range). The
value `/60` is outside this range and fails validation.

This is a common mistake when trying to create an hourly trigger — the
intuition is "every 60 minutes" but the field represents minute-of-the-hour,
not a duration.

## Solution

Use `hours` for hourly triggers:

```yaml
# Bad: /60 is out of range for minutes (0-59)
triggers:
  - trigger: time_pattern
    minutes: "/60"

# Good: fire every hour
triggers:
  - trigger: time_pattern
    hours: "/1"

# Good: fire every 2 hours
triggers:
  - trigger: time_pattern
    hours: "/2"

# Good: fire every 30 minutes
triggers:
  - trigger: time_pattern
    minutes: "/30"
```

Valid ranges:
- `seconds`: 0-59
- `minutes`: 0-59
- `hours`: 0-23

The `/N` pattern means "every N units" but the base value must be valid
within the field's range. So `/30` works for minutes (fires at :00 and :30),
but `/60` does not.

## Prevention

- For hourly or multi-hour intervals, always use the `hours` field.
- Remember that `time_pattern` fields represent clock positions, not durations.
- Check automation setup in Developer Tools > YAML after adding new
  time_pattern triggers to confirm they loaded without errors.
