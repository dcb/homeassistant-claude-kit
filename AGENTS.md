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
- Read `docs/house-rules.md` before adding automations that affect routines. If the file is inaccessible (privacy mode), ask the user for relevant constraints.
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

## Versioning, Releasing & Upgrading

The kit is versioned with semver and a structured changelog. The source of truth is
`kit-changelog.yaml` (self-describing — its inline `schema:` block is the contract);
`CHANGELOG.md` is rendered from it and is never hand-edited. `.kit-version` records which kit
version an install is based on.

Two procedures are written as Claude Code skills, but their `SKILL.md` bodies are plain numbered
runbooks any agent can follow. If you are **not** running in Claude Code (e.g. Codex), execute the
procedure by reading and following the steps in the relevant file:

- **Cut a new kit version** → follow `.claude/skills/release/SKILL.md` (+ `references/changelog-schema.md`).
  Producer-only; runs inside the kit repo. Validate with `python tools/validate_changelog.py` before committing.
- **Upgrade an install to a newer kit version** → follow `.claude/skills/upgrade/SKILL.md` (+
  `references/apply-rubric.md`). It reads `kit-changelog.yaml`, checks each change against the local
  code, and applies/skips/asks per change on a work branch — never a blind merge. Safety boundaries
  (auto-allowlist, secret-path policy, 3-way merge, never-execute-detect/apply) are in the rubric.

Never hand-edit `CHANGELOG.md` (regenerate from `kit-changelog.yaml`); never run `git push --tags` or push
to an inferred remote in `release` — resolve the kit remote by URL match and confirm first.
