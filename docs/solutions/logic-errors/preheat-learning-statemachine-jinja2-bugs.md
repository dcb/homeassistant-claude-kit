---
title: "Adaptive Preheat Round-2 Bugs: Rate Sampling Pollution, Stale State, Delta Miscalculation, Inconsistent Temp Variable, Dead Helper, Hardcoded Cap"
date: 2026-03-20
category: logic-errors
tags:
  - climate
  - preheat
  - state-machine
  - ema
  - jinja2
  - template-sensors
  - input-helpers
  - hardcoded-values
  - away-mode
  - boiler
  - trv
problem_type: logic_error
symptoms:
  - Learned heating rates drift upward over time due to EMA sampling while boiler flow-temp is boosted during preheat
  - TRVs and boiler remain in stale preheat state after a mode transition because zone climate and central heating evaluation are not called on deactivation
  - Away-return preheat fails to trigger when schedule preheat is already active because the delta is computed against the boosted effective_target rather than the base target
  - One zone uses a different temperature read path (inline states() call) than the others (stored variables), risking subtle evaluation-time inconsistencies
  - Preheat lead time capped at hardcoded value instead of respecting the user-configured input helper
---

# Adaptive Preheat: Round-2 Logic Bugs

Six bugs found by multi-agent code review (round 2) in an adaptive preheat automation system. All bugs were independently introduced but share two underlying failure modes: **state pollution across automation phases** and **incomplete state transitions**.

## Root Cause Pattern

These six bugs share two failure modes. The first is **state pollution across automation phases**: data that is correct in one phase (normal heating rates, normal effective targets) becomes incorrect when another phase is active (preheat boost, schedule injection), and code that did not check which phase it was in read the polluted values as if they were reliable. The second is **incomplete state transitions**: when the automation deactivated preheat, it updated its own bookkeeping (the mode selector, the timer) but did not propagate that change downstream to the physical devices (TRVs, boiler). Both patterns produce bugs where the automation's internal state and the physical state of the house diverge silently.

---

## Bug A: Learned Rates Sampled During Preheat Boost

**Root Cause**

A learning automation ran every 15 minutes whenever the boiler was heating in a Winter mode. It did not check whether preheat was active. During preheat, the boiler receives a flow temperature boost, so zones heat measurably faster than under normal conditions. The EMA absorbed these inflated observations, shifting the learned rate upward. On the next day, the preheat lead-time calculation divided the required delta by a rate that was too high, so preheat started later than necessary and rooms were still cold at the target time.

**Before**

```yaml
# learning automation conditions
conditions:
- condition: state
  entity_id: climate.your_boiler
  state: heat
- condition: template
  value_template: "{{ states('input_select.climate_mode') in ['Winter', 'Winter-Eco'] }}"
```

**After**

```yaml
conditions:
- condition: state
  entity_id: climate.your_boiler
  state: heat
- condition: template
  value_template: "{{ states('input_select.climate_mode') in ['Winter', 'Winter-Eco'] }}"
- condition: state
  entity_id: input_select.preheat_mode
  state: idle
```

**Why the fix is correct**: The guard ensures the EMA only learns from periods when the boiler is running under normal conditions. Preheat-boosted observations are structurally unrepresentative and must be excluded to keep the rate estimate unbiased.

---

## Bug B: Mode-Change Deactivation Missing Zone Updates

**Root Cause**

When `climate_mode` changed away from a heating mode during active preheat, the deactivation branch reset `input_select.preheat_mode` to `idle` and cancelled the timer -- and stopped there. The effective target sensors then reverted to normal targets because preheat mode was idle, but the TRVs were never told about the change. They retained their preheat setpoints and continued calling for heat. The boiler stayed on. There was no path back to normal operation until the next scheduled evaluation fired.

This affected both deactivation branches: the non-heating mode transition and the eco-mode transition.

**Before** (both branches):

```yaml
sequence:
- action: input_select.select_option
  data:
    option: idle
  target:
    entity_id: input_select.preheat_mode
- action: timer.cancel
  target:
    entity_id: timer.preheat_timeout
```

**After** (both branches):

```yaml
sequence:
- action: input_select.select_option
  data:
    option: idle
  target:
    entity_id: input_select.preheat_mode
- action: timer.cancel
  target:
    entity_id: timer.preheat_timeout
- action: script.update_zone_climate
  data:
    zone_id: zone_a
- action: script.update_zone_climate
  data:
    zone_id: zone_b
- if:
  - condition: template
    value_template: "{{ is_state('person.your_occupant', 'home') }}"
  then:
  - action: script.update_zone_climate
    data:
      zone_id: zone_c
- action: script.evaluate_central_heating
  data: {}
```

**Why the fix is correct**: A state transition is only complete when all physical devices are aligned with the new logical state. Updating the mode selector without propagating to TRVs leaves the system in a split state. The fix mirrors the same zone-update calls that all other deactivation paths (auto-deactivation, safety timeout) already used.

---

## Bug C: Away-Return Delta Used Preheat-Injected Target

**Root Cause**

The `away_return` activation check measured how far each zone was from its target to decide whether a preheat lead time was needed. It read `sensor.*_effective_target` for this. If `preheat_mode == schedule` was active when `away_mode` turned off (e.g., the house was empty during a normally-scheduled preheat window), `effective_target` was already showing the next-transition temperature -- higher than the true resting target. The computed delta appeared smaller than reality, so the activation threshold was less likely to trigger and away-return preheat would be skipped, leaving the house cold.

**Before**

```yaml
- variables:
    zone_a_delta: >
      {{ states('sensor.zone_a_effective_target') | float(20)
         - states('sensor.zone_a_temperature') | float(20) }}
    zone_b_delta: >
      {{ states('sensor.zone_b_effective_target') | float(20)
         - states('sensor.zone_b_temperature') | float(20) }}
```

**After**

```yaml
- variables:
    base_target: "{{ states('input_number.target_temperature') | float(20) }}"
    zone_a_delta: >
      {{ base_target - states('sensor.zone_a_temperature') | float(20) }}
    zone_b_delta: >
      {{ base_target - states('sensor.zone_b_temperature') | float(20) }}
```

**Why the fix is correct**: The away-return decision must be made against the stable resting target, not against a value that may already be inflated by a concurrent preheat. The base `input_number` is the ground truth; `effective_target` is a transient injection used only to drive TRV setpoints during the preheat window itself.

---

## Bug D: One Zone Reads Temperature Inline Instead of Variable

**Root Cause**

The `needs_preheat` template expression captured most zone temperatures in named variables (`zone_a_temp`, `zone_b_temp`) early in the variable block, then referenced those in the final expression. One zone skipped that step and called `states(...)` inline inside `needs_preheat`. This inconsistency meant that zone's branch read sensor state at a different moment than the other branches, and made the logic harder to audit and modify consistently.

**Before**

```yaml
# Zone C temperature only referenced inline in needs_preheat
needs_preheat: >
  {{ ... or (occupant_home and zone_c_temp_ok
      and states('sensor.zone_c_temperature') | float(0) < next_target - hysteresis_off) }}
```

**After**

```yaml
# Zone C temperature captured as a variable alongside the others
zone_c_temp: "{{ states('sensor.zone_c_temperature') | float(0) }}"

# needs_preheat uses the variable
needs_preheat: >
  {{ ... or (occupant_home and zone_c_temp_ok
      and zone_c_temp < next_target - hysteresis_off) }}
```

**Why the fix is correct**: All zones now follow the same pattern -- read once into a variable, use the variable everywhere. This eliminates the inconsistency, makes `needs_preheat` easier to read, and ensures all temperature values in the expression come from the same evaluation pass.

---

## Issue E: Orphaned Helper Left in Config

**Root Cause**

During a prior refactor, a global fallback heating rate helper was superseded by per-zone `input_number.learned_heating_rate_*` helpers. The new helpers were added, but the old one was not removed from `configuration.yaml`. Dead helpers accumulate in the UI, appear in entity searches, and mislead future readers into thinking the fallback rate is still in use.

**Fix**: Removed the old helper block from the `input_number:` section of `configuration.yaml`. No automation or template referenced it after the refactor.

---

## Issue F: Hardcoded Cap in Preheat Minutes Sensors

**Root Cause**

All preheat-minutes template sensors capped the computed lead time with `{{ [minutes, 180] | min }}`. The project rule is that all tunable thresholds must be exposed as input helpers -- no magic numbers in templates. The hardcoded 180 was undocumented, not configurable, and inconsistent with `input_number.preheat_max_duration` (which defaults to 120 and is configurable 30-240).

**Before** (all preheat-minutes sensors):

```yaml
{{ [minutes, 180] | min }}
```

**After**:

```yaml
{{ [minutes, states('input_number.preheat_max_duration') | int(120)] | min }}
```

**Why the fix is correct**: The cap now reads the same helper that governs the timer timeout, so both safety limits are guaranteed to be consistent. Raising the max duration in the Settings view is immediately reflected in both the lead-time cap and the timer duration.

---

## Prevention Strategies

### Per-Bug-Class Rules

**Class 1 -- Learning systems must exclude intervention periods**

Any automation that samples real-world measurements to update a learned model must gate on "is the system in its baseline state?" before recording. If a boost, override, or intervention is active, skip the sample entirely.

Rule: Every learning trigger must begin with a condition asserting all relevant modes are idle. For heating rate learning: `preheat_mode == 'idle'` AND no manual overrides are active. Treat the condition block as load-bearing documentation of what "clean sample" means.

Pattern name: **Gated Learning** -- the condition block is the noise filter, not an optimisation.

**Class 2 -- State machine transitions must always call their side-effect scripts**

Resetting a state machine variable is not the same as deactivating the state. Every transition (especially to `idle`) must explicitly invoke the downstream scripts that normal operation uses -- zone updates, central heating evaluation, TRV commands. Never assume "nothing changed" or that the next scheduled run will clean up.

Rule: For every `input_select.set` that moves a state machine to idle/off, the same action block must immediately call the relevant actuator-update scripts. If those calls are absent, the transition is incomplete.

Checklist trigger: search for every place the state variable is set to `idle` -- verify each one is followed by actuator updates.

**Class 3 -- Use base input helpers as reference, never computed sensors**

Computed/effective sensors are outputs of the control system. Using them as inputs to decisions that activate the same control system creates a feedback loop: if the feature is already partially active, the measurement is already contaminated.

Rule: Threshold comparisons that decide whether to activate a feature must reference the raw `input_number` or `input_select` -- never a sensor that may already reflect the feature's influence.

Heuristic: if the sensor name contains `effective`, `computed`, `adjusted`, or `boosted`, it must not appear on the input side of an activation condition.

**Class 4 -- Choose one variable capture pattern and apply it uniformly**

A Jinja2 template that mixes `{% set x = states(...) %}` captures with inline `states(...)` calls in the same expression will produce subtly different evaluation semantics. Beyond correctness, inconsistency makes the template harder to audit.

Rule: Within any Jinja2 block covering multiple zones or entities, always use `{% set %}` capture for every entity read. Never mix captured and inline reads in the same logical expression.

Code review signal: if you see `states('sensor.x')` appearing inline in an arithmetic expression anywhere below a `{% set zone_a_temp = states(...) %}` line, flag it.

**Class 5 -- Remove old helpers immediately when they are superseded**

A helper that is defined but never referenced is dead weight. It persists in the registry, appears in the UI, and creates confusion about which value is authoritative.

Rule: whenever a helper is replaced, the commit that adds the replacements must also delete the original. A defined-but-unreferenced helper in `configuration.yaml` is a bug, not cleanup debt.

Enforcement: after any refactor that adds new helpers, grep for every old helper ID across all YAML files. Zero references means delete immediately.

**Class 6 -- All numeric caps, thresholds, and durations must be input helpers**

Hardcoded numbers in template sensors are configurable values in disguise. They violate the project rule and make tuning require code changes instead of UI changes.

Rule: before committing any template sensor or automation, grep for numeric literals in Jinja2 expressions. Ask: "could a user reasonably want to tune this?" If yes, it must become an `input_number`. Acceptable literals are pure constants (0, 1, unit conversion factors) -- not thresholds, caps, durations, or offsets.

---

### Review Checklist

When reviewing any automation involving a state machine, learning system, or multi-zone control:

**Learning system**
- [ ] Does every sample site assert all interventions (boosts, overrides, manual modes) are idle before recording?
- [ ] Could the thing being learned be artificially inflated or deflated by the control system at the moment of sampling?

**State machine transitions**
- [ ] For every transition to idle/off/cancelled: are actuator-update scripts called immediately in the same action block?
- [ ] Search every location where the state variable is set -- does each one handle physical side effects, not just logical state?

**Reference entities**
- [ ] Do activation conditions compare against raw `input_number`/`input_select` values, or against derived sensors?
- [ ] If a feature is already partially active, would its own sensors cause it to mis-evaluate its activation threshold?

**Template consistency**
- [ ] Are all entity reads in a multi-zone Jinja2 block done via `{% set %}` captures, with no inline `states()` calls in arithmetic?
- [ ] Is the same pattern used for every zone in the block?

**Helper lifecycle**
- [ ] Were any helpers replaced or renamed in this change? If so, are the old definitions deleted?
- [ ] Does every new helper appear in the Settings view in the dashboard?

**Hardcoded values**
- [ ] Grep for numeric literals in every Jinja2 expression -- for each one: pure constant or tunable value?
- [ ] Do all caps, timeouts, durations, temperature offsets, and thresholds reference `input_number` helpers?
