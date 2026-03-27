---
description: Rules for working on homeassistant-claude-kit template cards
paths:
  - docs/templates/cards/*.tsx
  - docs/templates/cards/*.ts
---

# Template Card Rules

## Prerequisites documentation

Every domain-specific template card must have a `@file` JSDoc block at the top of the
file. Use `@ha-*` custom tags (not `@requires` — that tag has reserved JSDoc semantics):

- `@ha-integration` — the HA integration that must be installed and configured
- `@ha-helpers` — `input_*` entity that must be created in `configuration.yaml`
- `@ha-automation` — YAML automation file that must exist and be loaded

End the block with: "Remove this block once prerequisites are satisfied and entity IDs
are filled in entities.ts."

## Entity ID wiring

Entity ID constants in `dashboard/src/lib/entities.ts` are empty strings (`"" as EntityId`)
until configured during setup. Always check `entities.ts` and the card's `@ha-*` block
before wiring entity IDs into a new card. Never infer entity IDs from component names.

## State string comments

Non-obvious state string values must be commented at the point of comparison to identify
the source system. Examples:
- OCPP connector states: `"Charging"` (capital C) — NOT Tesla Fleet values
- ebusd status strings: values depend on your boiler model's ebusd message definitions

## What NOT to document

Do NOT add JSDoc to:
- Self-evident utility functions (formatters, math helpers)
- Type-only files or simple constants
- Standard TypeScript/React patterns Claude already knows

## BoilerCard specifics

Do NOT include boiler-model-specific configuration in BoilerCard or BoilerDiagCard.
Users supply their own ebusd config files for their specific boiler hardware. The JSDoc
block documents only the integration type and the general format of ebusd status strings.
