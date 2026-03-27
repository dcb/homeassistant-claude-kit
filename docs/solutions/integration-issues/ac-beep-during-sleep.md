---
title: "Mini-split AC beeps on every HA service call — suppress during sleep"
category: integration-issues
date: 2026-03-26
tags:
  - climate
  - ac
  - mini-split
  - ir-control
  - sleep
  - noise
  - automation-gating
---

## Problem

A bedroom mini-split AC beeps audibly during sleep hours whenever Home Assistant sends an automated climate service call (`climate.set_temperature`, `climate.set_hvac_mode`, `climate.set_fan_mode`). Adaptive automations that adjust temperature or fan speed throughout the night cause repeated beeps that wake occupants.

## Root Cause

Every `climate.*` service call to an IR-controlled or WiFi-controlled mini-split sends a command that makes the indoor unit emit an acknowledgment beep. This is a hardware behavior -- the AC unit beeps on every received command regardless of source (remote, app, or HA).

Automations that run periodic adjustments (e.g., adaptive temperature curves, fan speed changes based on outdoor temperature, mode transitions) send multiple commands per night, each producing a beep.

There is no way to disable the beep via the HA integration or the AC's IR protocol. The beep is hardwired into the indoor unit's firmware.

## Solution

Define silence hours and gate all AC automation branches to suppress commands during those hours. When silence begins, set the AC to its final nighttime configuration. When silence ends, restore normal automation control.

### 1. Create input helpers for silence window

```yaml
input_datetime:
  ac_silence_start:
    name: AC Silence Start
    has_date: false
    has_time: true
    # Default: 22:00
  ac_silence_end:
    name: AC Silence End
    has_date: false
    has_time: true
    # Default: 07:00
```

### 2. Create a template binary sensor for silence state

```yaml
template:
  - binary_sensor:
    - name: AC Silence Active
      unique_id: ac_silence_active
      state: >
        {% set now_t = now().strftime('%H:%M') %}
        {% set start = states('input_datetime.ac_silence_start') %}
        {% set end = states('input_datetime.ac_silence_end') %}
        {% if start > end %}
          {{ now_t >= start or now_t < end }}
        {% else %}
          {{ start <= now_t < end }}
        {% endif %}
```

### 3. Gate all AC automation branches

Every automation that calls a `climate.*` service on the bedroom AC must check silence state:

```yaml
# Before any climate service call in bedroom automations:
- condition: state
  entity_id: binary_sensor.ac_silence_active
  state: "off"
```

### 4. Set-and-forget at silence start

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.ac_silence_active
    to: "on"
actions:
  - action: climate.set_temperature
    target:
      entity_id: climate.your_bedroom_ac
    data:
      temperature: "{{ states('input_number.bedroom_night_temperature') | float(22) }}"
  - action: climate.set_fan_mode
    target:
      entity_id: climate.your_bedroom_ac
    data:
      fan_mode: quiet
```

### 5. Restore normal control at silence end

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.ac_silence_active
    to: "off"
actions:
  # Call your normal zone evaluation script to restore adaptive control
  - action: script.your_zone_climate_update
    data:
      zone_id: bedroom
```

## Prevention

- **Treat AC beeps as a hard constraint** in automation design for bedrooms and nurseries. Any automation that controls a mini-split in a sleeping area must be silence-aware from the start.
- **Minimize command count**: Instead of multiple granular adjustments, compute the final desired state and send a single command. Batch `set_temperature` + `set_fan_mode` into one service call where the integration supports it.
- **Test with actual hardware**: Silent operation cannot be verified in HA's developer tools. Always test overnight with the physical AC unit to confirm no beeps occur during silence hours.
- **Document which AC models beep**: Some models have a "quiet beep" or "beep off" setting in their remote. If your model supports it, that is a better solution than automation gating. Check the AC manual before implementing the software workaround.
