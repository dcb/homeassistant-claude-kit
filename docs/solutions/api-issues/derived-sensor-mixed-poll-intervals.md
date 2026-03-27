---
title: "Derived sensor math breaks when mixing sensors with different poll intervals"
category: api-issues
date: 2026-03-26
tags:
  - sensors
  - template-sensors
  - polling
  - stale-data
  - energy
  - dashboard
  - null-coalescing
---

## Problem

A dashboard or template sensor that computes a derived value from multiple sensors shows impossible results -- for example, negative house consumption when subtracting EV charger power from total load:

```
houseW = loadW - evChargerW
```

The values periodically show `houseW = -800W`, which is physically impossible (the house cannot generate power from appliances).

## Root Cause

Two compounding issues:

### 1. Mixed poll intervals produce stale subtraction

The sensors being combined have different update intervals:

| Sensor | Poll interval | Source |
|--------|--------------|--------|
| `sensor.grid_load_power` | 2 minutes | Local Modbus |
| `sensor.ev_charger_power` | 5 minutes | Cloud API |

When `grid_load_power` updates to a new (lower) value but `ev_charger_power` still holds its previous (higher) reading from 3 minutes ago, the subtraction produces a negative number. The stale value is not wrong per se -- it was accurate when sampled -- but it is wrong in the context of the computation.

### 2. `?? 0` null coalescing hides unavailability

A common defensive pattern in template sensors:

```yaml
# DANGEROUS: converts "unavailable" to zero silently
value_template: >
  {{ (states('sensor.grid_load_power') | float(0))
     - (states('sensor.ev_charger_power') | float(0)) }}
```

When the EV charger sensor becomes `unavailable` (integration restart, cloud API timeout), `float(0)` silently converts it to zero. The derived sensor now shows the full grid load as "house consumption", which may be wildly incorrect if the charger was drawing 7kW.

The combination is insidious: stale data produces incorrect values some of the time, and `?? 0` / `float(0)` converts outright unavailability into silently wrong values.

## Solution

### 1. Never use `?? 0` or `float(0)` for sensors that might be unavailable

Instead, check availability explicitly and propagate `unavailable` state:

```yaml
template:
  - sensor:
    - name: House Power Consumption
      unique_id: house_power_consumption
      unit_of_measurement: W
      device_class: power
      state: >
        {% set load = states('sensor.grid_load_power') %}
        {% set ev = states('sensor.ev_charger_power') %}
        {% if load in ['unavailable', 'unknown'] or ev in ['unavailable', 'unknown'] %}
          unavailable
        {% else %}
          {{ (load | float) - (ev | float) }}
        {% endif %}
      availability: >
        {{ states('sensor.grid_load_power') not in ['unavailable', 'unknown']
           and states('sensor.ev_charger_power') not in ['unavailable', 'unknown'] }}
```

### 2. Check `last_updated` freshness before computing derived values

For sensors with known different poll intervals, reject stale inputs:

```yaml
state: >
  {% set load = states('sensor.grid_load_power') %}
  {% set ev = states('sensor.ev_charger_power') %}
  {% set load_age = (now() - states.sensor.grid_load_power.last_updated).total_seconds() %}
  {% set ev_age = (now() - states.sensor.ev_charger_power.last_updated).total_seconds() %}
  {% set max_age = 600 %}
  {% if load in ['unavailable', 'unknown'] or ev in ['unavailable', 'unknown'] %}
    unavailable
  {% elif load_age > max_age or ev_age > max_age %}
    unavailable
  {% else %}
    {{ (load | float) - (ev | float) }}
  {% endif %}
```

### 3. Display unavailable state explicitly in dashboards

In dashboard code, never substitute zero for unavailable:

```typescript
// BAD: hides staleness
const houseW = (loadW ?? 0) - (evW ?? 0);

// GOOD: propagate unavailability
const houseW =
  loadW != null && evW != null ? loadW - evW : null;

// Render null as "unavailable" in UI, not as 0 or blank
```

### 4. Use `state_class: measurement` correctly

Ensure derived sensors use `state_class: measurement` so that HA's long-term statistics handle them correctly and gaps are visible in history graphs rather than interpolated.

## Prevention

- **Audit all template sensors that combine multiple sources.** For each, verify that all input sensors have compatible update intervals. If they do not, add freshness checks.
- **Ban `float(0)` as a default for power/energy sensors.** Use `float` without a default (which raises an error, forcing you to handle unavailability) or explicitly check state first.
- **Add physical sanity bounds.** If a derived value must be non-negative (house consumption), clamp it and log when clamping occurs -- the clamp is a symptom indicator, not a fix:
  ```yaml
  {{ [0, (load | float) - (ev | float)] | max }}
  ```
- **Document poll intervals** for every integration in your system docs. When designing derived sensors, check that all inputs update at compatible rates.
- **Test with one sensor unavailable.** Temporarily disable one integration and verify the derived sensor shows `unavailable`, not zero.
