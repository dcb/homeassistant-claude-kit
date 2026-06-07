---
title: v0.3.0 — the upgrade skill (consumer-side selective apply)
type: feat
status: completed
date: 2026-06-07
origin: docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md
---

# v0.3.0 — `upgrade` skill (consumer-side selective apply)

Phase 3. The consumer half of the kit-versioning system: an agent-driven skill that pulls later kit
versions into a *diverged* install, applying only the changes still relevant **here**. Design is
carried from the Phase-1 plan (`docs/plans/2026-06-07-001-...`: Out-of-Scope/Phase-3 + risks R5–R8 +
Appendix A/C invariants) and the deepen-round prior-art borrows (copier/cruft). Now buildable because a
real `v0.1.0→v0.2.0` changeset exists to test against.

## Deliverables
- `.claude/skills/upgrade/SKILL.md` (resumable, non-destructive, branch-only) + `references/apply-rubric.md`.
- `.gitignore`: add `.upgrade-state.json` (the resume tracker).
- README "Updating": already points at the `upgrade` skill (done in v0.2.0) — verify wording.
- Cut **`v0.3.0`** via the `release` skill (the skill is a `feature`).

## Skill flow (SKILL.md)
1. **Step 0 — prereqs** (sentinels): is a git repo; **clean tree** precisely = `git diff --quiet && git diff --cached --quiet` (untracked allowed); **resume check** — if `.upgrade-state.json` exists and is incomplete AND `HEAD` is still its recorded work-branch, resume; else fresh.
2. **Resolve the kit remote** (R7): `origin` if its URL matches the kit, else `upstream`, else offer to add `upstream` from `.kit-version`/the known kit URL. **Display the URL + confirm before any fetch** — never trust `.kit-version: source` blindly.
3. **Fetch** into a namespaced refspec (`refs/kit/*` / `--tags` to a namespace) so upstream can't clobber local tags. **Verify the target tag** (`git verify-tag`); if unsigned/unverifiable (our tags are annotated, not signed), **downgrade every change to `ask`** and tell the user.
4. **Resolve baseline** (H1 — most-authoritative first): recorded `commit` in `.kit-version` (if present + reachable) → tag matching `.kit-version` `version:` → `git merge-base HEAD <kit>/main`. If two layers disagree by >0 commits, **surface it** (no silent pick).
5. **Target** = latest verified tag. **Changeset** = `kit-changelog.yaml` entries with `version` in (baseline, target]. Show the user the plan (each entry + predicted action) before touching anything — a `--check`/dry-run is the safe default entry point.
6. **Work branch** + init `.upgrade-state.json` (record branch name, baseline + target SHAs, per-entry status).
7. **For each entry, in order:**
   - **conditions** (presence gate): feature/file absent → skip (esp. `skip-if-absent`).
   - **detect** (relevance gate): read local code (optionally the `detect_hint` grep) — already-fixed/diverged → skip. **`detect`/`apply`/`detect_hint` are descriptive data, NEVER executed as shell.**
   - **default_action is a CEILING, not authority (R6):** `auto` is honored ONLY for path-safe data files (`config/**/*.yaml`, `dashboard/src/**` non-config, `docs/**`, `CHANGELOG.md`, `.kit-version`). Any change touching `tools/**`, `Makefile`, `.claude/**`, `package*.json`, `*.config.*`, `*.sh`, `*.py`, `.github/**` is **forced to `ask`** regardless of what the entry requests.
   - **Secret-bearing paths (R8):** `config/secrets.yaml`, `config/go2rtc.yaml`, `config/esphome/**`, `.env*`, anything in `.claude/privacy-patterns` → **never auto-apply/commit**; present intent only (not the secret-laden hunk); be privacy-mode-aware (if privacy mode is on, list but don't open).
   - **Apply via git 3-way merge** (`git apply --3way` / `git merge-file`) using the entry's `commits` as ground truth — inline conflict markers, never `.rej`, never `--force`. On conflict → present hunk + `apply` intent, ask.
   - **Validate per area** (C2): dashboard/lib change → `cd dashboard && npx tsc -b --noEmit` (no SSH); `config/` change → `make validate` **only if `config/configuration.yaml` exists locally**; **`make deploy-dashboard` is a separate, user-gated post-upgrade step — never in the apply loop** (its `rsync --delete` hits the live HA box).
   - **Stage by explicit path** (never `git add -A`); **pre-commit secret scan** on the staged diff — block the commit if a token/password/RTSP-cred pattern appears.
   - Record outcome (applied / skipped+reason / asked / needs-manual) in the tracker. **Validate after each; no blind parallel apply** (entity-rename lesson: 3/7 batches silently failed).
8. **Finish:** bump `.kit-version` → target (`version` + `commit`) **in the same commit as the last applied change**, **only on a clean finish**. If any entry is unresolved/needs-manual, leave the pointer behind and record it (so staleness still reports "behind"). **Summarize** applied/skipped/asked — no silent caps.
9. **`ask`/conflict under unattended runs = hard pause** (F6): record "needs human", continue remaining `auto`-safe entries, surface the queue at the end. Never auto-decide an `ask`.

## references/apply-rubric.md
The decision procedure: conditions vs detect; the auto path-allowlist + forced-ask list; the secret-path set; the 3-way-merge apply recipe (`git apply --3way`, fallback `git merge-file`, inline markers); the "detect/apply are never executed" rule; the resume contract; the per-area validation matrix; the rollback command.

## Acceptance criteria
- [ ] `upgrade` SKILL.md present, house style (frontmatter+Trigger phrases, Step 0 sentinels, Completion, Troubleshooting), resumable + non-destructive.
- [ ] `references/apply-rubric.md` present with the auto-allowlist, secret-path set, 3-way recipe, resume contract.
- [ ] `.upgrade-state.json` gitignored.
- [ ] **Dogfood test**: simulate a `v0.1.0` install (clone @ v0.1.0), run the upgrade flow against `v0.2.0` — verify baseline resolves, the 5 changeset entries are enumerated with correct predicted actions (e.g. TRV fix `detect` finds the bug present → apply; recipes `skip-if-absent` if no recipes dir), the auto-allowlist forces `ask` for the `.claude/skills` + `tools/` changes, and nothing is force-applied. (Full apply is interactive; verify the mechanics + decisions.)
- [ ] Cut `v0.3.0`.

## Safety posture (non-negotiable, from R5–R8 + the user's standing "no destructive actions" rule)
Branch-only · no force-push · no delete · stage-by-path · secret-scan-before-commit · validate-after-each · deploy is separately confirmed · auto is a ceiling not authority · detect/apply never executed · advance version pointer only on clean finish.
