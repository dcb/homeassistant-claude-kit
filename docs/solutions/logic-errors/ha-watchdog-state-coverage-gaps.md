---
title: "Health Watchdog Blind Spots: Startup Race + Unknown State + Stale Filter"
category: logic-errors
date: 2026-03-16
tags:
  - home-assistant
  - health-monitoring
  - watchdog
  - unavailable-state
  - unknown-state
  - startup-race-condition
severity: medium
symptoms:
  - Integration silently dead with no alert fired
  - Sensors unavailable after HA restart but watchdog never triggered
  - Unknown-state sensors invisible to both state triggers and stale sensor detection
description: >
  Health watchdog automations had three compounding blind spots: (1) entities
  restored from DB on boot skip state-change triggers entirely, requiring a
  homeassistant_start trigger with delay; (2) all watchdogs only matched
  `unavailable`, missing the `unknown` state; (3) the stale sensor script
  explicitly filtered out `unknown` sensors. Together these let a dead
  integration go undetected indefinitely.
---

## Problem

An integration was completely dead (sensors `unavailable` with `restored: true`), but the health watchdog automation never fired. `last_triggered: null` confirmed it had never run. The config entry showed `state: loaded` with no error -- the integration thought it was fine, but entities were stuck from DB restoration.

## Root Cause

Three independent gaps combined to produce a silent watchdog:

### Gap 1 -- Startup race condition (no state transition)

When HA reboots, entities are restored from the database as `unavailable` before integrations initialize. A `trigger: state ... to: unavailable` never fires because there is no *transition* -- the entity is already `unavailable` from the moment HA starts. The watchdog waits for a change that never comes.

### Gap 2 -- Missing `unknown` state

The original watchdog only watched for `to: unavailable`. Some integrations land entities in `unknown` instead (particularly during partial initialization failures). `unknown` is a distinct HA state, not a subtype of `unavailable`.

### Gap 3 -- Stale sensor detection skipped `unknown`

The stale sensor detection loop filtered out both `unavailable` and `unknown` sensors. A sensor in `unknown` state was simply invisible -- not reported as stale, not caught by the watchdog.

## Investigation

1. Read watchdog config -- found it only triggered on `to: unavailable`
2. Checked sensor state on HA: `unavailable` with `restored: true` -- confirmed DB-restoration path, no transition fired
3. Checked watchdog `last_triggered: null` -- never ran
4. Checked config entry state: `loaded` (no error flag) -- integration "up" at entry level but not producing data
5. Manually reloaded config entry -- sensors recovered immediately
6. Identified three fixes needed: startup trigger, `unknown` state coverage, stale filter fix

## Solution

### 1. Watchdog: dual trigger (state change + startup check)

```yaml
# BEFORE -- only catches runtime transitions
triggers:
- trigger: state
  entity_id:
  - sensor.your_monitored_sensor
  - sensor.your_second_sensor
  to: unavailable
  for:
    minutes: 3

# AFTER -- catches both runtime and boot-time failures
triggers:
- trigger: state
  entity_id:
  - sensor.your_monitored_sensor
  - sensor.your_second_sensor
  to:                   # empty = any state change
  for:
    minutes: 3
  id: state_change
- trigger: homeassistant
  event: start
  id: startup

actions:
- if:
  - condition: trigger
    id: startup
  then:
  - delay:
      minutes: 5        # give integration normal init time
  - condition: template
    value_template: >
      {{ states('sensor.your_monitored_sensor') in ['unavailable', 'unknown']
         or states('sensor.your_second_sensor') in ['unavailable', 'unknown'] }}
  else:
  - condition: template
    value_template: "{{ trigger.to_state.state in ['unavailable', 'unknown'] }}"
```

### 2. All watchdogs: trigger on both `unavailable` and `unknown`

```yaml
# BEFORE -- Integration Monitor
to: unavailable

# AFTER -- matches any transition, filtered by condition
to:
conditions:
- condition: template
  value_template: "{{ trigger.to_state.state in ['unavailable', 'unknown'] }}"
```

Post-reload checks also updated:
```yaml
# BEFORE
value_template: '{{ is_state(trigger.entity_id, "unavailable") }}'

# AFTER
value_template: "{{ states(trigger.entity_id) in ['unavailable', 'unknown'] }}"
```

### 3. Stale sensor detection: report `unknown` sensors

```yaml
# BEFORE -- unknown sensors silently skipped
{% if states(s) not in ['unavailable', 'unknown'] %}

# AFTER -- unknown sensors explicitly reported
{% if states(s) == 'unknown' %}
  {% set stale = stale + [states[s].name ~ ' (unknown)'] %}
{% elif states(s) not in ['unavailable'] %}
  ... check last_updated ...
{% endif %}
```

## Prevention: The Canonical Watchdog Pattern

Every HA health watchdog should follow this pattern:

```yaml
triggers:
  # Catches mid-session failures
  - trigger: state
    entity_id: [monitored entities]
    to:
    for:
      minutes: N
    id: state_change

  # Catches failures that exist at boot
  - trigger: homeassistant
    event: start
    id: startup

actions:
  # Grace period for startup trigger only
  - if:
    - condition: trigger
      id: startup
    then:
    - delay:
        minutes: 5
  # Assert current state before acting
  - condition: template
    value_template: >
      {{ states('sensor.your_monitored_sensor') in ['unavailable', 'unknown'] }}
  # ... reload / notify actions
```

### Rules

1. **Every watchdog needs two trigger types** -- `state` for runtime, `homeassistant: start` for boot
2. **Always check both `unavailable` AND `unknown`** -- they are distinct states, both mean "no usable data"
3. **Add a grace period after startup trigger** -- 3-5 minutes prevents false positives during normal init
4. **Include actual state in alert messages** -- helps diagnose `unavailable` vs `unknown` vs other states
5. **Match state filters everywhere** -- if watchdogs check both states, stale detection must too

### Checklist for Reviewing Watchdog Automations

- [ ] Has both `state` trigger AND `homeassistant: start` trigger
- [ ] State checks include both `unavailable` and `unknown`
- [ ] Startup trigger has a grace period delay
- [ ] Post-reload recovery checks include both states
- [ ] Helper templates/filters use the same state list
- [ ] Alert message includes `{{ trigger.to_state.state }}` or equivalent

## Related

- [Watchdog bare `to:` trigger flapping](watchdog-bare-to-trigger-flapping.md) -- complementary issue where bare `to:` causes reload loops
- [Watchdog single-shot reload failure](watchdog-single-shot-reload-failure.md) -- watchdog fires correctly but gives up after one reload attempt
