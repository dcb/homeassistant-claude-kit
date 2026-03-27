---
title: event.fire service does not exist in Home Assistant
category: template-issues
date: 2026-03-26
tags: [events, service-calls, hallucination, actions]
---

# event.fire service does not exist in Home Assistant

## Problem

An automation action using `event.fire` fails silently or raises an error:

```yaml
actions:
  - action: event.fire
    data:
      event_type: my_custom_event
      event_data:
        key: value
```

## Root Cause

There is no `event.fire` service in Home Assistant. This is a common
hallucination from LLMs and a frequent piece of misinformation found online.
The `event` domain does not expose any services.

## Solution

Use the `event:` action type directly in the automation actions list. This is
a first-class action type, not a service call:

```yaml
actions:
  - event: my_custom_event
    event_data:
      key: value
```

This fires `my_custom_event` on the HA event bus. Other automations can listen
for it with:

```yaml
triggers:
  - trigger: event
    event_type: my_custom_event
```

## Prevention

When firing custom events from automations, always use the `event:` action
type syntax. There is no service-based equivalent. If an LLM or online source
suggests `event.fire`, `homeassistant.fire_event`, or similar, it is incorrect.
Consult the [official HA automation actions documentation](https://www.home-assistant.io/docs/automation/action/)
for the canonical syntax.
