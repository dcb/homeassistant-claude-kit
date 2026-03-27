# Agent Conventions

Tool-agnostic conventions for AI coding assistants (Cursor, GitHub Copilot, Windsurf, etc.). If you are Claude Code, follow `CLAUDE.md` instead — it has additional hook and permission configuration.

## Core Principles

1. **Read before writing.** Before touching any file, read it. Before using an entity ID, verify it exists via `make entities` or `docs/system-*.md`. Never guess.

2. **Validate before deploying.** Always run `make validate` before `make push`. The pre-push hook enforces this, but you should validate proactively after edits.

3. **Document every change.** After pushing changes, update the relevant `docs/system-*.md` file. No automation or helper should be undocumented.

4. **Ask when uncertain.** Entity IDs, device behavior, household schedules, and user preferences require runtime knowledge. Ask rather than assume.

## Boundaries

### Always Do
- Read `docs/system-*.md` for the relevant domain before modifying automations
- Read `docs/house-rules.md` before adding automations that affect routines
- Run `make validate` after editing any YAML in `config/`
- Reload the relevant domain after `make push` (`automation/reload`, `script/reload`, etc.)
- Update `docs/system-*.md` after any configuration change

### Ask First
- Creating new `input_number`, `input_boolean`, or `input_select` helpers
- Adding automations that interact with existing ones
- Changing `configuration.yaml` (requires HA restart, not just reload)
- Deleting or renaming automations, scripts, or helpers

### Never Do
- Modify files in `config/.storage/` — these are managed by HA at runtime
- Hardcode thresholds, timeouts, or temperatures — use `input_*` helpers
- Use `continue_on_error: true` to silence failures
- Guess entity IDs — always verify
- Push without validating

## File Editing Rules

- YAML files in `config/` are safe to edit locally and push with `make push`
- `.storage/` files must only be changed through the HA UI
- Dashboard files (`dashboard/src/`) are safe to edit; run `make deploy-dashboard` to deploy

## Validation

Run `make validate` after any YAML change. Entity IDs matching `your_*` are treated as template placeholders and skipped during validation.

## Adding New Automations

Follow the patterns in `docs/system-*.md` for the relevant domain. See `CLAUDE.md` for the full automation pattern reference (motion lights, helper requirements, etc.).

## Dashboard Cards

The `dashboard/src/components/cards/` directory contains the core card set. Domain-specific cards (heating zones, solar, EV charger, boiler) live in `docs/templates/cards/` as reference implementations — copy them into `dashboard/src/` if you need them.

See `dashboard/CLAUDE.md` for the full dashboard development guide.
