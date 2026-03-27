---
title: "History API minimal_response omits entity_id after first entry"
category: api-issues
date: 2026-03-26
tags: [history-api, minimal_response, entity_id, websocket]
---

# History API minimal_response omits entity_id after first entry

## Problem

When fetching history via the `/api/history/period` endpoint or the
`history/stream` WebSocket subscription with `minimal_response: true`,
`entity_id` is `undefined` on every event object except the first one in each
entity's array. Code that reads `entry.entity_id` on arbitrary entries silently
gets `undefined`, causing lookup failures, broken filters, and missing chart
series.

## Root Cause

The `minimal_response` flag is a bandwidth optimization. Home Assistant strips
redundant fields from every entry after the first one in each per-entity array.
Because the API groups results as `Array<Array<StateEntry>>` (one inner array
per requested entity), the `entity_id` only appears on index 0 of each inner
array -- it would be identical for every subsequent entry in the same array.

## Solution

Extract the `entity_id` from the first entry of each entity array and propagate
it when processing:

```ts
for (const entityHistory of response) {
  if (!entityHistory.length) continue;
  const entityId = entityHistory[0].entity_id;

  for (const entry of entityHistory) {
    // entry.entity_id is only set on the first element
    const id = entry.entity_id ?? entityId;
    // ... process entry with id
  }
}
```

Alternatively, since the outer array order matches the requested entity order,
you can zip the results with the original entity ID list.

## Prevention

- Always document which fields are stripped by `minimal_response` when adding
  new history consumers.
- Unit test history parsing with realistic payloads where only the first entry
  carries the full field set.
- Prefer iterating with the outer array index to recover the entity identity
  rather than relying on each entry carrying it.
