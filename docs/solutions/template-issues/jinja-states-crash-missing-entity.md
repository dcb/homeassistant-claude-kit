---
title: "Jinja states[] lookup on missing entity aborts entire script"
category: template-issues
date: 2026-03-26
tags: [jinja2, template, states, missing-entity, heterogeneous-devices]
---

# Jinja states[] lookup on missing entity aborts entire script

## Problem

All TRVs in a climate zone are stuck in off mode. The automation or script
responsible for toggling heating modes fails silently with a template error
in the logs.

## Root Cause

The script iterates over TRV devices and accesses a calibration entity using
`states['number.trv_name_calibration']`. One TRV model does not expose a
calibration entity. The `states[]` dictionary lookup (bracket notation) on a
non-existent key throws a `UndefinedError`, which aborts the **entire
template evaluation** — not just the iteration for that one device.

This means the mode-toggle logic that runs after the calibration step never
executes for any device.

```jinja2
{# This crashes if the entity doesn't exist #}
{% set cal = states['number.trv_bedroom_calibration'].state %}
```

## Solution

Guard every `states[]` lookup with an existence check:

```jinja2
{# Safe: check before access #}
{% set cal_id = 'number.' ~ trv_name ~ '_calibration' %}
{% if cal_id in states %}
  {% set cal = states[cal_id].state | float(0) %}
{% else %}
  {% set cal = 0 %}
{% endif %}
```

Or use the `states()` function with a default:

```jinja2
{# Also safe: states() function returns 'unknown' for missing entities #}
{% set cal = states('number.' ~ trv_name ~ '_calibration') | float(0) %}
```

Key differences:
- `states['entity_id']` — raises error if entity missing (bracket notation)
- `states('entity_id')` — returns `'unknown'` if entity missing (function call)
- `states.entity_domain.entity_name` — returns `None` if missing (dot notation)

## Prevention

- Always use `states()` function or guard `states[]` bracket lookups with
  `if entity_id in states`.
- When iterating over heterogeneous device models (e.g., different TRV
  manufacturers), assume some devices will lack optional entities.
- Test scripts against each device model individually to catch missing
  entity issues before deploying to production.
