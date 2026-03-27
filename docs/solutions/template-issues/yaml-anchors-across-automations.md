---
title: YAML anchors don't work across automation list items in split files
category: template-issues
date: 2026-03-26
tags: [yaml, anchors, split-files, includes]
---

# YAML anchors don't work across automation list items in split files

## Problem

Defining a YAML anchor in one automation and referencing it in another within
the same split file fails with "anchor not found":

```yaml
# automations/climate.yaml
- alias: "Heating on"
  triggers:
    - trigger: state
      entity_id: &climate_entities
        - climate.living_room
        - climate.bedroom
  # ...

- alias: "Heating off"
  triggers:
    - trigger: state
      entity_id: *climate_entities  # ERROR: anchor not found
```

## Root Cause

Each top-level list item in a split automation file is parsed as a **separate
YAML document**. YAML anchors are scoped to the document where they are
defined. The second automation cannot see anchors from the first because they
are in different document scopes.

This is a YAML specification limitation, not a Home Assistant bug.

## Solution

**Option A: Inline the full entity list in each automation.**

Duplicate the list where needed. This is the simplest and most readable
approach for short lists.

**Option B: Use `!include` for shared entity lists.**

Create a shared snippet file:

```yaml
# includes/climate_entities.yaml
- climate.living_room
- climate.bedroom
```

Reference it in each automation:

```yaml
entity_id: !include ../includes/climate_entities.yaml
```

## Prevention

Never rely on YAML anchors (`&`/`*`) to share data between automations in
split files. Use `!include` for shared snippets, or accept the duplication for
short lists. Anchors only work within a single list item (single automation).
