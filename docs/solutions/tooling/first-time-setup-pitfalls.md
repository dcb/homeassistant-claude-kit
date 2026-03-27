---
title: "First-Time Setup Pitfalls — Lessons from End-to-End Testing"
category: tooling
tags: [setup, ssh, makefile, env, entity-discovery, registry, onboarding]
date: 2026-03-27
severity: high
---

## Problem

First-time setup of the kit had multiple friction points that required user intervention
to resolve. A test session revealed 5 critical failures and 3 moderate issues across
the setup-infrastructure and setup-customize skills.

## Root Causes and Fixes

### 1. SSH test omitted `$SSH_USER` (Critical)

**Symptom:** `Permission denied (publickey)` when SSH was actually working.

The skill template tested `ssh "$HA_HOST"` which connected as the local macOS user
(e.g., `john`) instead of `root`. The `.env` had `SSH_USER=root` but it was never used.

**Fix:** All SSH commands now use `"$SSH_USER@$HA_HOST"`. The Makefile's `check-env`,
`pull`, `push`, `diff`, `deploy-dashboard`, and `test-ssh` targets all updated.

### 2. Inline comments in `.env.example` broke Makefile (Critical)

**Symptom:** `Unable to connect to Home Assistant via SSH (homeassistant.local        )`
— note the trailing whitespace.

Makefile's `include .env` treats everything after `=` as the value, including `# comment`
text and preceding whitespace. Bash `source` strips comments, so direct SSH worked but
`make pull` didn't.

**Fix:** `.env.example` now uses only full-line comments. Added warning in both the
file and the skill instructions.

### 3. Default `HA_REMOTE_PATH=/config/` wrong for HA OS (Critical)

**Symptom:** `make pull` pulled the SSH root home directory instead of HA configuration.

HA OS with the SSH add-on mounts config at `/homeassistant/`, not `/config/`. The default
was wrong for a common deployment type.

**Fix:** Step 4 of setup-infrastructure now auto-detects the correct path by testing
`configuration.yaml` existence at both paths. `.env.example` documents both options.

### 4. Entity mapping by name heuristic instead of registry (Critical)

**Symptom:** Motion sensors missing from 3 rooms, Smart TV assigned to wrong room.
Required 4 correction rounds with escalating user frustration.

`ha-ws entity list <domain>` doesn't show area assignments. Without querying the device
and entity registries, Claude guessed room assignments from entity ID naming patterns.

**Fix:** Step 1 of setup-customize now mandates querying:
- `config/floor_registry/list` — floors
- `config/area_registry/list` — rooms with floor assignments
- `config/device_registry/list` — device → area mapping
- `config/entity_registry/list` — entity → area overrides

Name inference is explicitly documented as a fallback for sparse registries, requiring
user confirmation for all inferred assignments.

### 5. Consent re-asked on skill re-invocation (Moderate)

**Symptom:** Data consent prompt shown 5 times across 3 skill invocations.

**Fix:** Skill now says "Only ask once per session."

### 6. `source .env` doesn't export to subprocesses (Moderate)

**Symptom:** `python3 -c` couldn't see `HA_URL` because `source .env` doesn't export.

**Fix:** Notification discovery and other Python snippets now use `set -a && source .env && set +a`.
SSH-based ha-api/ha-ws commands added as alternative (more reliable).

### 7. npm install not run before build (Moderate)

**Symptom:** `tsc` failed because `node_modules/` didn't exist.

**Fix:** Step 9 now explicitly runs `npm install` before TypeScript verification.

## Prevention

- All SSH commands in skills and Makefile must include `$SSH_USER@`
- `.env.example` must never use inline comments on value lines
- Entity discovery must use registry APIs, not name parsing
- Skills should be idempotent without re-asking already-answered questions
- Build steps must verify dependencies are installed
