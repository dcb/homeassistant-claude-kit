---
title: "mode: single drops subsequent triggers that fire while automation is running"
category: automation-issues
date: 2026-03-26
tags: [automation, mode-single, trigger, race-condition]
---

# mode: single drops subsequent triggers that fire while automation is running

## Problem

An automation with multiple triggers silently drops a secondary trigger that
fires while the automation is already executing. Critical follow-up actions
never run.

## Root Cause

With `mode: single` (the default), Home Assistant ignores any new trigger that
arrives while the automation's action sequence is still running. This becomes
a trap when the automation's own actions cause state changes that would fire
another of its triggers:

1. Trigger A fires, automation starts running.
2. An action in the sequence changes entity state.
3. That state change matches Trigger B.
4. Trigger B is silently dropped because the automation is already running.

The trace shows only Trigger A's execution. Trigger B leaves no trace at all.

## Solution

- Place essential follow-up actions **after** the `choose` block so they run
  unconditionally regardless of which trigger started the execution.

- Do not gate critical cleanup or state-setting on `trigger.id` when the
  automation's own actions can cause secondary triggers.

- If both triggers genuinely need independent full runs, use `mode: queued`
  or `mode: parallel` instead:

```yaml
automation:
  - alias: "Example with queued mode"
    mode: queued
    max: 3
    triggers:
      - trigger: state
        entity_id: sensor.power
        id: power_change
      - trigger: state
        entity_id: input_boolean.override
        id: override_toggle
    actions:
      - choose:
          - conditions: "{{ trigger.id == 'power_change' }}"
            sequence: [...]
          - conditions: "{{ trigger.id == 'override_toggle' }}"
            sequence: [...]
      # Critical actions here run for ALL triggers
      - action: input_boolean.turn_off
        target:
          entity_id: input_boolean.pending_flag
```

## Prevention

- When an automation's actions modify entities that appear in its own trigger
  list, assume secondary triggers will occur.
- Default to `mode: queued` for automations with multiple triggers whose
  actions have side effects on monitored entities.
- Check automation traces for missing trigger executions during testing.
