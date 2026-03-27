---
title: "image.* entity: use state for capture timestamp, not last_updated"
category: api-issues
date: 2026-03-26
tags: [image, entity, timestamp, last_updated, snapshots]
---

# image.* entity: use state for capture timestamp, not last_updated

## Problem

Snapshot cards in a dashboard always show "just now" or the current time as
the capture timestamp, even for images taken hours ago.

```typescript
// Wrong: always shows recent time
const captureTime = entity.last_updated;
```

## Root Cause

`last_updated` on an `image.*` entity updates on **every integration poll
cycle**, regardless of whether the image content changed. If the integration
polls every 30 seconds, `last_updated` is always within 30 seconds of now.

The actual image capture timestamp is stored in the entity's `state` attribute,
which is an ISO 8601 datetime string representing when the image was actually
captured or last changed.

## Solution

Use the entity's `state` value, which contains the actual capture timestamp:

```typescript
// Correct: shows actual capture time
const captureTime = entity.state; // "2026-03-26T14:30:00+00:00"
```

In Jinja2 templates:

```yaml
# Correct
value_template: >
  {{ states('image.front_door_snapshot') | as_datetime }}

# Wrong -- updates every poll
value_template: >
  {{ states.image.front_door_snapshot.last_updated }}
```

## Prevention

For any entity where you need to display "when did this data actually change"
versus "when did HA last check," always verify which attribute carries the
semantically correct timestamp. For `image.*` entities specifically, `state`
is the capture time and `last_updated` is the poll time. This distinction
applies to other entity types too -- always check the integration docs.
