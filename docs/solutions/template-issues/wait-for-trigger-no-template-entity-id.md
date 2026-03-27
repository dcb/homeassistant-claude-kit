---
title: "wait_for_trigger does not support template entity_id"
category: template-issues
date: 2026-03-26
tags: [wait_for_trigger, template, script, entity_id, reload]
---

# wait_for_trigger does not support template entity_id

## Problem

A script using a Jinja2 template in the `entity_id` field of a
`wait_for_trigger` action silently fails to wait. Worse: the broken script
definition prevents the **entire scripts file** from reloading — all scripts
in that file become stale.

## Root Cause

`wait_for_trigger` does not support Jinja2 templates in the `entity_id` field.
Unlike regular automation triggers where some fields accept templates, the
wait_for_trigger action validates entity_id at parse time, not at runtime.

When the template cannot be resolved, the script definition is considered
invalid. Home Assistant's script reload is atomic per file — one broken script
definition causes the entire YAML file to fail validation, preventing all
scripts in that file from reloading.

## Solution

Use `wait_template` instead for dynamic entity IDs:

```yaml
# Bad: template in wait_for_trigger entity_id
- wait_for_trigger:
    - trigger: state
      entity_id: "{{ target_entity }}"  # Silently fails
      to: "on"

# Good: wait_template with dynamic entity
- wait_template: >
    {{ is_state(target_entity, 'on') }}
  timeout: "00:05:00"
  continue_on_timeout: true
```

If you need wait_for_trigger specifically (e.g., for trigger variables),
pass the resolved entity_id from a preceding `variables` step that maps
a known set of options:

```yaml
- choose:
    - conditions: "{{ room == 'kitchen' }}"
      sequence:
        - wait_for_trigger:
            - trigger: state
              entity_id: binary_sensor.kitchen_motion
              to: "off"
```

## Prevention

- Never use Jinja2 templates in `wait_for_trigger` entity_id fields.
- After editing any script file, always verify reload succeeded by checking
  Developer Tools > Services > script.reload or the HA logs.
- Keep scripts that are experimental or under development in a separate YAML
  file to avoid poisoning stable scripts on reload failure.
