---
title: update_entity with multiple entity IDs makes one API call per entity
category: api-issues
date: 2026-03-26
tags: [update_entity, api, rate-limiting, polling]
---

# update_entity with multiple entity IDs makes one API call per entity

## Problem

API credits for a rate-limited cloud service (e.g., Tesla Fleet API) are
exhausted far faster than expected. The automation calls `update_entity` with
several entity IDs, assuming it batches them into one request:

```yaml
actions:
  - action: homeassistant.update_entity
    target:
      entity_id:
        - sensor.car_battery_level
        - sensor.car_charging_state
        - sensor.car_location
        - binary_sensor.car_plugged_in
```

## Root Cause

`homeassistant.update_entity` makes a **separate upstream API call for each
entity ID** in the list. The call above generates 4 independent API requests
to the cloud service, not one batched request. For metered APIs with daily
quotas (e.g., Tesla's 200 requests/day), this multiplies usage by the number
of entities.

## Solution

Pass only **one entity** to `update_entity`. Most integrations fetch all data
in a single API call and update all their entities from the response. Updating
one entity triggers a full data refresh that updates siblings automatically:

```yaml
actions:
  - action: homeassistant.update_entity
    target:
      entity_id: sensor.car_battery_level
    # This single call fetches all car data and updates
    # charging_state, location, plugged_in, etc.
```

Additionally, reduce poll frequency for metered APIs:

```yaml
# In configuration.yaml or integration options
scan_interval: 300  # 5 minutes instead of default 30 seconds
```

Use event-driven updates (webhooks, push notifications) where available
instead of polling.

## Prevention

Before calling `update_entity` with multiple entities, check whether the
integration fetches all data in a single upstream call. If it does, update
only one entity to trigger the refresh. Monitor API usage dashboards to catch
unexpected consumption early. For rate-limited APIs, always prefer the minimum
number of `update_entity` calls and use longer polling intervals.
