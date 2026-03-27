---
title: Hysteresis inversion (start < stop threshold) causes control oscillation
category: automation-issues
date: 2026-03-26
tags: [hysteresis, oscillation, climate, thermostat, flapping]
---

# Hysteresis inversion (start < stop threshold) causes control oscillation

## Problem

A heating automation flaps every 10 seconds between active and idle states.
The system rapidly turns on, then off, then on again, never settling.

## Root Cause

The start hysteresis is set to 0.0 and the stop hysteresis to 0.5, creating
an **inverted dead band**. For a setpoint of 22.0:

- Start condition: temperature < 22.0 (setpoint - 0.0)
- Stop condition: temperature >= 22.5 (setpoint + 0.5)

When the actual temperature is between 22.0 and 22.5, neither the start nor
stop condition is exclusively true in a clean way. But the real problem occurs
around the setpoint: the system starts heating, overshoots slightly, stops,
cools back below setpoint, starts again -- all within seconds because the
dead band is too narrow or inverted relative to the sensor's update rate.

With start_threshold = 0 (start at exactly setpoint), even tiny measurement
noise causes rapid cycling. The stop threshold being higher than the start
threshold means the system has to overshoot before it stops, then immediately
re-triggers.

## Solution

Ensure the start hysteresis is **greater than or equal to** the stop
hysteresis so there is a proper dead band:

```yaml
# Correct: start further from setpoint than stop
start_threshold: 0.5  # start heating at setpoint - 0.5
stop_threshold: 0.0   # stop heating at setpoint + 0.0
```

This creates a dead band: heating starts at 21.5, stops at 22.0, and won't
restart until temperature drops back to 21.5.

Use the **same `input_number` helpers** everywhere the decision is made to
avoid mismatched thresholds between automations:

```yaml
input_number:
  climate_hysteresis_start:
    name: "Start offset (below setpoint)"
    min: 0.0
    max: 2.0
    step: 0.1
  climate_hysteresis_stop:
    name: "Stop offset (above setpoint)"
    min: 0.0
    max: 2.0
    step: 0.1
```

## Prevention

When implementing any on/off control loop with hysteresis, always verify that
`start_threshold >= stop_threshold` to create a proper dead band. Use shared
`input_number` helpers referenced in all automations making the same control
decision to prevent threshold drift between files.
