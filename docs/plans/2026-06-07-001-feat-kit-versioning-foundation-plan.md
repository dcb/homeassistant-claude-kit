---
title: Kit Versioning + Agent-Driven Upgrade System — Phase 1 (Foundation)
type: feat
status: active
date: 2026-06-07
origin: docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md
---

# ✨ Kit Versioning — Phase 1 (Foundation + `release` skill)

## Enhancement Summary

**Deepened on:** 2026-06-07 — 3 rounds. R1: 6 agents (2 researchers: template-update tooling + changelog/semver; 4 reviewers: architecture, security, simplicity, agent-native). R2: 3 agents (architecture-verification, spec-flow, detailed-design → Appendix A/B). R3: 3 agents (consistency audit, test strategy → Appendix D, release-correctness red-team → Appendix C invariants).

### Key improvements folded in
1. **Re-scope (CONFIRMED):** defer the `upgrade` skill to a new **Phase 3** (built + tested against the *real* `v0.1.0→v0.2.0` changeset Phase 2 produces). Four reviewers independently concluded it can't be honestly built/tested while the changelog is empty, and it carries ~all the security risk. Phase 1 keeps `release` (Phase 2 dogfoods it). ~40–50% smaller, safer Phase 1.
2. **R1 is bigger than first stated and is a pre-existing breakage:** the *entire* `dashboard/src/lib/` is untracked, so a clean clone of the kit **cannot compile**. **Round-2 correction:** the `entities.ts`/`areas.ts` scaffolds (empty-string `as EntityId` casts) are *exactly what makes a clone compile*, so they must be **tracked** (not ignored) — `setup-customize` overwrites them locally, and the Phase-3 `upgrade` skill reconciles upstream changes. No `entities.example.ts`. README line ~205 wrongly bundles `lib/` as "untracked"; correct it to the real untracked set (`config/`, `.env`, `dashboard/.env.local`, `setup-state.json`).
3. **Resolved the bump-rule contradiction + made it TOTAL** (Round-3 red-team C-2: the earlier `breaking|feature→MINOR, fix→PATCH` left `security`/`change`/`removed` with no bump arm → a security-only release was un-releasable). Final rule: **default PATCH for any releasable entry; escalate to MINOR if any entry is `feature` or `breaking`** (0.x); highest-wins; `breaking` is an orthogonal boolean. At ≥1.0.0, `breaking`→MAJOR.
4. **Release-skill safety hardening** (security): explicit-remote single-tag push (never bare `--tags` — this user's `origin` is their *private* `ha-config.git`!), `gh release create --repo`, pre-existing-tag guard (no `-f`), signed tags, and intent-contract enforcement (flag thin commits before release).
5. **Cross-tool parity gap (agent-native):** `.claude/skills/` is Claude-only discovery; `AGENTS.md` mentions "skill" zero times, so **Codex cannot invoke these**. Add an AGENTS.md runbook pointing at the SKILL.md bodies + an acceptance criterion.
6. **Build-sequence fix:** tag `v0.1.0` **first** (before the R1 commit, else `v0.1.0` includes R1). Verify the SHA — current `origin/main` is `2fbf556`, not the stale `fc0db17` cited earlier.
7. **Prior art confirms the design's moat** and supplies borrows — `.kit-version` ≈ copier's `.copier-answers.yml` / cruft's `.cruft.json`; use git **3-way merge** (not per-commit `git apply`) for the eventual apply step **[Phase 3]**; add a `skip` glob list **[Phase 3]**; the cruft "silent version-bump on partial failure" bug validates our "advance pointer only on clean finish" rule.

### New considerations discovered
- **Upstream→RCE risk** (security R6): the upgrade transport fetches+executes kit files (`make validate`→`python tools/*`, `make deploy-dashboard`→`npm run build`). `default_action: auto` must be a *ceiling*, never authority to run transported executable/build files. → Phase 3.
- **Secret leakage** (security R8): real installs track secret-bearing config (`config/go2rtc.yaml` has RTSP creds). Upgrade must never auto-apply/commit those, must be privacy-mode-aware, and must stage by explicit path. → Phase 3.
- **`dashboard/package.json` `version: 0.0.0`** is an orphan version field nobody updates — `release` should bump it (or it's declared pinned).

---

## Overview

Build the machinery that lets a `homeassistant-claude-kit` install pull later fixes/features **selectively**, agent-driven, without a blind `git merge` that would wreck a diverged install (see brainstorm: `docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md`). Sequenced machine-first so later phases dogfood the machinery.

**Phase split (CONFIRMED):**
- **Phase 1 (this plan):** baseline tag, `.kit-version`, seed `kit-changelog.yaml`, the **`release`** skill, the **R1** lib/-tracking fix, and docs + cross-tool parity.
- **Phase 2 (later):** the real content sync (recipes/irrigation/fixes) cut as **`v0.2.0`** by running `release` — produces the first real changeset.
- **Phase 3 (later):** the **`upgrade`** skill, built + tested against the real `v0.1.0→v0.2.0` changeset, with the full security/safety/resume hardening below.

## Problem Statement

The kit ships clone-based with **no version, no tags, no changelog**, and a naive `git pull` "Updating" doc. Installs diverge hard, so merge is brittle. There's no way for an agent to answer "what changed since this install, and is each change still relevant *here*?" (brainstorm: hybrid model). Separately, the kit is **currently non-buildable from a clean clone** because all of `dashboard/src/lib/` is gitignored (R1).

## Proposed Solution

Hybrid model (brainstorm: Key Decision 1): git = precise "what changed" transport; structured changelog = "is it relevant here, apply/skip/ask" intent layer; an agent walks the diff per-change. **Prior art** (copier `copier update`, cruft `cruft update`, changesets, Keep a Changelog) confirms this shape; our per-change `detect`/`apply`/`default_action` relevance layer is the genuinely novel part with no equivalent in those tools — they blind-merge the whole template delta. Phase 1 stands up the producer half + foundation.

## Technical Approach

### Architecture (Phase 1 deliverables)

```
homeassistant-claude-kit/
├── .kit-version              # NEW — anchor (version + commit). Kit's own = current released version.
├── kit-changelog.yaml        # NEW — structured source of truth; SELF-DESCRIBING (inline schema block)
├── CHANGELOG.md              # NEW — hand-written 3-line seed in P1; rendered by `release` from P2 on
├── .claude/skills/release/   # NEW — SKILL.md + references/changelog-schema.md
├── .claude/skills/setup-infrastructure/  # MODIFIED — Step 10: stamp .kit-version (idempotent)
├── dashboard/src/lib/         # NEWLY TRACKED — ALL of it, incl. entities.ts + areas.ts
│                             #   scaffolds (empty-string casts make a clean clone compile) + adapters/
├── AGENTS.md / CLAUDE.md     # MODIFIED — versioning convention + release runbook (cross-tool parity)
├── README.md / SETUP.md      # MODIFIED — replace "Updating"; correct the "lib/ untracked" claim
├── .gitignore                # MODIFIED — narrow `lib/` (!dashboard/src/lib/); ignore .upgrade-state.json
└── dashboard/package.json    # version bumped by `release`
```

`upgrade` + fork-remote wiring move to Phase 3; the CHANGELOG renderer's first real run + `gh release create` first fire in Phase 2 (no Phase-1 consumer; simplicity review).

### Skill house style (verified against existing skills)

New skills MUST match: frontmatter = only `name` + folded `description:` ending in `Trigger phrases:`; body = `# Title` → bold-invariant intro → `## Step 0: Prerequisites` (bash sentinel checks `OK`/`MISSING`) → numbered `## Step N` with `### Na` substeps → sentinel-branch bullets → `>` user-copy → `## Completion` → `## Troubleshooting` table. Verbose lookups in `references/`.

### Component 1 — Baseline tag `v0.1.0` (do FIRST)

- **Anchor SHA CONFIRMED: `2fbf556`** (current `origin/main`; the earlier `fc0db17` was stale). `git tag -a v0.1.0 2fbf556 -m "Baseline"` → `git push origin v0.1.0`.
- Tag **before** the R1 commit so `v0.1.0` is the true pre-machinery baseline; R1 then becomes the first post-baseline change (a `v0.2.0` "Changed" entry).

### Component 2 — `.kit-version` anchor (trimmed)

Repo-root YAML, committed in the kit with the current released version:

```yaml
# Which homeassistant-claude-kit version this install is based on.
# In the KIT repo: the current released version (authoritative, bumped by `release`).
# In an INSTALL: stamped by setup-infrastructure; bumped by `upgrade` (Phase 3).
version: 0.1.0
commit: ""   # kit commit SHA last synced to; history-independent baseline anchor (ZIP installs)
```

- Dropped `source`/`upgraded_at` (simplicity): `source` duplicates the git remote (and is attacker-editable — don't trust it for remote resolution; security C2); `upgraded_at` has no reader. Add later in Phase 3 if `upgrade` needs them.
- **Role disambiguation** (architecture C3): on the *kit repo*, `version:` is authoritative and only `release` changes it. `setup-infrastructure` Step 10 (on an *install*) writes only `commit`/stamp — it must **not** rewrite `version:` when run inside the kit's own repo (guard: skip if `kit-changelog.yaml` is tracked here = you're the producer).

### Component 3 — `setup-infrastructure` Step 10 (new, idempotent)

After Step 9 (the existing checkpoint step), before Completion:
- **Stamp ONLY `commit`** (= resolved kit-remote HEAD) on the install — **never write `version:`** (the shipped value is authoritative). This sidesteps the producer/consumer-discriminator problem entirely (SI-1: "is `kit-changelog.yaml` tracked" mis-classifies installs, since installs ship it too). Setup never needs to write `version:`.
- **Idempotency:** stamp `commit` only when empty/missing; never overwrite a non-empty `commit` (an `upgrade` may have advanced it).
- **No-git / ZIP install (SI-2):** if there's no `.git` or the remote is unreachable, leave `commit: ""` and continue — do not error (the `version:` field alone supports baselining; that's why `commit` is optional).
- **Upstream/fork-remote wiring deferred to Phase 3** with `upgrade` (its only consumer; simplicity).

### Component 4 — `kit-changelog.yaml` (self-describing) + seed `CHANGELOG.md`

**Schema** (carried from brainstorm: Key Decision 4, refined by changelog + agent-native reviews). Make the file **self-describing** — inline a `schema:` block so an agent can consume it cold (agent-native F4):

```yaml
schema_version: 1
schema:   # inline contract so the YAML is consumable without external docs
  type: "fix | feature | change | removed | security  (drives CHANGELOG section)"
  breaking: "bool — orthogonal to type; drives the version bump"
  default_action: "auto | ask | skip-if-absent  (a CEILING the entry requests, never authority)"
  conditions: "presence gate — does this file/feature exist in the install at all?"
  detect: "relevance gate — agent-interpreted PROSE (never executed); is the pattern still present? optional generic grep hint allowed, never an entity ID"
  apply: "guidance for adapting the diff to a diverged install; ground truth is `commits`"
  commits: "SHAs — the real diff (git show); apply must stay within baseline..target"
changes:
  - id: baseline-v0-1-0
    version: 0.1.0
    type: feature
    breaking: false
    title: "Initial release baseline"
    commits: [<v0.1.0 sha>]
    detect: ""
    apply: ""
    default_action: skip-if-absent
```

- `type` drives the rendered section (feature→Added, change→Changed, removed→Removed, fix→Fixed, **security→Security** always-surfaced); `breaking` (separate flag) drives the bump (changelog review — fixes the overloaded-`type` problem). `id` kept as a stable slug for the Phase-3 applied-ledger; `areas` dropped (derivable from `commits`; simplicity/M2). `conditions`=presence vs `detect`=relevance is a deliberate, documented split.
- **`CHANGELOG.md` in Phase 1 is a hand-written 3-line seed** pointing at the YAML; the YAML→Markdown renderer is first exercised in Phase 2 by `release` (simplicity — one trivial entry doesn't justify a renderer yet).

### Component 5 — `release` skill (`.claude/skills/release/`)

`SKILL.md` (**idempotent per version**) + `references/changelog-schema.md` (full field semantics + the intent contract + commit-message anti-patterns). Flow:

1. **Step 0 prereqs:** clean tree; on default branch; tags present; baseline `>= 0.1.0`. **Intent-contract gate** (architecture H2 / changelog review): scan `git log <lastTag>..HEAD`; if releasable commits are non-Conventional or body-less, **warn + list them** so the maintainer rewords before releasing (thin commits → hollow `detect`/`apply`).
2. Collect commits since last tag; **curate** into logical changes (group related commits → one entry; the AI-judgment step — Common Changelog "curate, don't dump git log").
3. **Derive `type`/`breaking` deterministically from Conventional Commits** (feat→feature, fix→fix, `!`/`BREAKING CHANGE:`→breaking; skip docs/chore/style/test/ci/refactor — replicate release-please's hidden set). AI judgment reduced to *grouping only*.
4. Synthesize entries: `title`, `commits`, generic `detect`/`apply` (no entity IDs — brainstorm: Key Decision 9), `default_action`.
5. **Bump (resolved, TOTAL):** while 0.x → **default PATCH for any releasable entry; escalate to MINOR iff any entry is `feature` or `breaking`** (covers `security`/`change`/`removed`-only → PATCH); highest-wins aggregation (one bump/release); makes the planned `v0.2.0` correct (a feature release). Switch to `breaking→MAJOR` at 1.0.0. **Compute the bump BEFORE synthesizing entries** (Round-3 C-1) so each entry's `version:` = the computed target.
6. Prepend new-version entries (append-only; never rewrite existing entries — tolerate hand-edits, changesets gotcha); **render `CHANGELOG.md`** (Keep a Changelog 1.1.0: `## [x.y.z] - YYYY-MM-DD` latest-first, Added/Changed/Removed/Fixed/Security, bottom `compare` links, `[**BREAKING**]` prefix, **omit `Unreleased`**, one-line entries with inline commit links); bump `.kit-version` + `dashboard/package.json`; **render-check (REL-5 fix):** render is idempotent — render to a temp file and diff temp-vs-working, expecting **zero** diff (NOT `git diff --exit-code CHANGELOG.md`, which always trips because the skill just wrote the file).
7. Commit `release: vX.Y.Z` (everything in one commit so version+content travel together); tag it. **Signing-key probe (REL-1 fix):** Step 0 tests `git config --get user.signingkey` + a dry `git tag -s` — if no key, **downgrade to `git tag -a`** with a logged warning rather than aborting mid-flow. Guard against an existing tag (no `-f`, ever). **Make commit+tag a transaction:** on any post-commit failure, roll back (`git reset --hard <pre-release-HEAD>` + delete the local tag).
8. **Push safely** (security H2): `git push <kit-remote-by-URL-match> refs/tags/vX.Y.Z` — never bare `--tags`, never an inferred remote (this user's `origin` is their private `ha-config.git`). Then `gh release create vX.Y.Z --repo <owner>/homeassistant-claude-kit` (explicit `--repo`), confirmed, idempotent (if tag exists & release missing → create; both exist → skip). **Decouple local creation from the confirmed push step.**

### Component 6 — Docs + cross-tool parity

- **`AGENTS.md`** (agent-native C1 — the parity gap): add a "Releasing / Upgrading" section instructing a non-Claude agent to *read and execute* `.claude/skills/release/SKILL.md` (and later `upgrade`). The SKILL.md body is already a plain numbered runbook — single source of truth, pointed at from both CLAUDE.md and AGENTS.md.
- **`README.md`:** replace "Updating" (naive `git pull`); **correct the now-false claim that `dashboard/src/lib/` is untracked** (R1 changes this — the real untracked set is `config/`, `.env`, `dashboard/.env.local`, `setup-state.json`; `dashboard/src/lib/` incl. the `entities.ts`/`areas.ts` scaffolds is now tracked).
- **`SETUP.md`:** note `.kit-version`; clone-with-untracked-config default; fork model documented as an option (wiring lands in Phase 3).

### Component 7 — R1: fix the `lib/` ignore (re-scoped; do first, after the tag)

(architecture C1 + simplicity #5 + spec-flow R-1 — verified: 0 files tracked under `dashboard/src/lib/`; 55+ tracked files import from it; **a clean clone won't compile today**.)
- Narrow `.gitignore` line 28 so it stops matching `dashboard/src/lib/`. **Exact mechanism (spec-flow R-3):** keep `lib/` but add `!dashboard/src/lib/`; `venv/lib/` stays ignored because `venv/` itself is ignored (verify). Then `git check-ignore -v` over all ~23 files to confirm the un-ignored set and that Python paths remain ignored.
- **Track ALL of `dashboard/src/lib/`** — the ~20 generic files (`format`, `useControlCommit`, `useNumericControl`, `useSliderControl`, `useControlGroup`, `downsample`, `date-utils`, …) **AND `dashboard/src/lib/adapters/*.ts`** (don't miss the subdir — N2) **AND the `entities.ts`/`areas.ts` scaffolds**.
- **CORRECTION (spec-flow R-1 — this reverses the earlier "keep them ignored" decision):** `entities.ts` (a large scaffold of constant names with empty-string `"" as EntityId` placeholders) and `areas.ts` (interface + commented example) are **exactly what makes a clean clone compile** — the `as EntityId` casts are intentional scaffolding. If they stay ignored, a fresh clone has no `lib/entities` module and `tsc` fails. So **track the scaffolds**. `setup-customize` overwrites them locally (a normal tracked-file modification); upstream changes to them are reconciled by the Phase-3 `upgrade` skill (flag as conflict-prone, never `auto`). No `entities.example.ts` needed.
- **Fresh-clone typecheck gate:** `git clone` to a temp dir → `cd dashboard && npm install && npx tsc -b --noEmit` — must pass with **no** setup step, because the tracked scaffolds make it compile. (A local check is a false pass; the maintainer's tree has populated files.)
- Also gitignore `.upgrade-state.json` (security M1) and confirm `dashboard/.gitignore` has no conflicting `lib` rule (it doesn't — verified).

### Build sequence
1. **Tag `v0.1.0` first**, pinning the SHA literally: `git tag -a v0.1.0 2fbf556 -m "Baseline"`; assert `git rev-list -n1 v0.1.0 == 2fbf556` and that `v0.1.0` does NOT contain the current feature-branch commits; `git push origin v0.1.0`. (T-1) Note: Phase-1 machinery + R1 land on `main` (merge the feature branch) so the linear-`main`, "R1 = first `v0.2.0` entry" logic holds.
2. R1: narrow gitignore (`!dashboard/src/lib/`), track all lib incl. `adapters/` + the `entities.ts`/`areas.ts` scaffolds; `git check-ignore -v` verify; fresh-`clone` `npm install && tsc -b --noEmit` (no setup step).
3. `.kit-version` (`version` + empty `commit`).
4. `kit-changelog.yaml` (self-describing inline `schema:` + seed entry) + hand-written 3-line `CHANGELOG.md` seed.
5. `tools/validate_changelog.py` (jsonschema; add `jsonschema` to the venv/requirements — setup Step 7 only installs `pyyaml`). (CL-1)
6. `release` skill + `references/changelog-schema.md` — see Appendix for the finalized schema + step outline (intent-contract gate, deterministic type/breaking, bump rule, idempotent render-check, signing probe, safe push).
7. `setup-infrastructure` Step 10 (stamp `commit` only; ZIP-safe).
8. Docs: README "Updating" + corrected untracked set; SETUP; CLAUDE.md + AGENTS.md `## Releasing` runbook pointing at the SKILL.md body.
9. Validate: dry-run `release` on a throwaway commit (no push) → valid entry, correct bump (feature→MINOR), idempotent render-check, local tag (signed or `-a` per key probe); exercise the empty-range / only-skip-list / unclassifiable-commit early exits.

## Alternative Approaches Considered
- Build `upgrade` in Phase 1 (original): rejected on deepening — no real changeset to consume/test; would be written blind then rewritten; concentrates all security risk. Deferred to Phase 3.
- Per-commit `git apply` for the eventual apply step: rejected — produces brittle `.rej` files (cruft's weak path). Use git **3-way merge** (`git merge-file`/`git apply --3way`) with inline markers (copier's approach). [Phase 3]
- `entities.example.ts` template: rejected — the tracked `entities.ts` scaffold already makes a clean clone compile and is overwritten locally by `setup-customize`; a parallel `.example` would be a 2nd source of truth.
- Bare-string `.kit-version`: kept `commit` for ZIP-install baselining; dropped the rest.

## System-Wide Impact
- **Interaction graph:** `release` writes data files + one commit + signed tag + GH release (outward, gated). No runtime/HA side effects. `setup-infrastructure` Step 10 touches only `.kit-version`.
- **Error/failure:** `release` Step-0 prereqs block on dirty tree / bad commits; partial GH release is idempotently re-creatable; render-check prevents CHANGELOG drift.
- **State lifecycle:** four version artifacts (tag, `.kit-version`, `kit-changelog.yaml`, `package.json`) all written by `release` in one commit → no drift; render-check enforces CHANGELOG derivability.
- **API surface parity:** `kit-changelog.yaml` is the producer/consumer contract — make it self-describing + add `tools/validate_changelog.py` (jsonschema) run by `release` before commit (architecture M3).

## Acceptance Criteria
### Functional
- [ ] `v0.1.0` tag on the confirmed SHA, pushed; created **before** the R1 commit.
- [ ] R1: `lib/` ignore narrowed (`!dashboard/src/lib/`); **all** of `dashboard/src/lib/` tracked incl. `adapters/` and the `entities.ts`/`areas.ts` scaffolds; `git check-ignore -v` confirms the un-ignored set + Python paths still ignored; **a fresh `git clone` compiles with NO setup step** (`npm install && npx tsc -b --noEmit`).
- [ ] `.kit-version` (`version: 0.1.0`, `commit`) committed; producer/consumer role guard documented.
- [ ] `kit-changelog.yaml` self-describing (inline `schema:` + `schema_version`) with the seed `v0.1.0` entry; `tools/validate_changelog.py` passes.
- [ ] Hand-written `CHANGELOG.md` seed present.
- [ ] `release` skill: house style; dry-run on a throwaway commit yields a valid entry, correct bump (feature→MINOR), KaC render, signed tag — **without pushing**; intent-contract gate flags thin commits; safe-push uses explicit remote + `--repo`; pre-existing-tag guard.
- [ ] `setup-infrastructure` Step 10 stamps `.kit-version` idempotently and does not rewrite `version:` in the kit repo.
- [ ] Docs: README "Updating" replaced + "lib/ untracked" claim corrected; **AGENTS.md runbook lets a non-Claude agent locate + execute `release`**.
### Quality gates
- [ ] All skills follow verified house style; `release` is idempotent per version (re-run on a released version = no-op).
- [ ] `release` bumps `dashboard/package.json` version in the same release commit (no orphan `0.0.0`).

## Risk Analysis & Mitigation
- **R1 — kit non-buildable from clean clone / `lib/` blind to transport (HIGH) — fix in Phase 1.** See Component 7. Reconcile the README contract.
- **R4 — version-artifact drift.** `release` writes tag + `.kit-version` + `kit-changelog.yaml` + `CHANGELOG.md` + `package.json` in one commit; render-check enforces CHANGELOG.
- **R5 — destructive action on a live repo (Phase 3 surface, noted now).** Phase 3 `upgrade`: precise "clean tree" definition + hard-require; restore point (`git rev-parse HEAD`) + documented rollback; `make deploy-dashboard`'s `rsync --delete` is a separately-confirmed step, never in the apply loop; stage by explicit path, never `git add -A`.
- **R6 — upstream→RCE via transported executable files (HIGH, Phase 3).** `default_action: auto` is a *ceiling, not authority*; hard path-allowlist for auto (config YAML, `dashboard/src` non-config, docs, CHANGELOG, `.kit-version`); force `ask` for `tools/**`, `Makefile`, `.claude/**`, `package*.json`, `*.config.*`, `*.sh`, `*.py`, `.github/**`. `detect`/`apply` are **never executed as shell**.
- **R7 — unverified remote/tags (Phase 1 release + Phase 3 upgrade).** Pin + display the remote URL before fetch/push; signed tags (`release`); `upgrade` runs `git verify-tag` and refuses auto-apply on unsigned/unverifiable tags; fetch tags into a namespaced refspec so upstream can't clobber local tags.
- **R8 — secret leakage during upgrade (HIGH, Phase 3).** Real installs track secret-bearing config (`config/go2rtc.yaml` creds). Never auto-apply/commit a sensitive-path set; privacy-mode-aware; pre-commit secret scan on the work branch; intent-only presentation for those hunks.
- **R3 — silent partial application** (entity-rename: 3/7 batches failed; cruft's silent version-bump bug). Phase 3: validate-after-each, no blind parallel apply, tracker, advance `.kit-version` only on clean finish.

## Out of Scope
- **Phase 2:** real content sync (recipes/irrigation/fixes) → `v0.2.0` via `release`; first real CHANGELOG render; `gh release create` first real run; IrrigationView drift check.
- **Phase 3:** the `upgrade` skill (baseline resolution, 3-way-merge apply, apply/skip/ask loop, resume tracker, validation-per-area, R5–R8 mitigations, fork-remote wiring, `skip` glob list in `.kit-version`).

## Resolved Decisions
1. **R1** — RESOLVED: fix in Phase 1 (re-scoped per C1 + Round-2 R-1: track the **whole** `dashboard/src/lib/` incl. the `entities.ts`/`areas.ts` scaffolds — they're what makes a clone compile; `setup-customize` overwrites locally; no `.example`).
2. **Install remote model** — RESOLVED: clone default (`upgrade` uses `origin`); fork documented as an option (wiring in Phase 3).
3. **GitHub Releases** — RESOLVED: `release` auto-creates them (`--repo`, confirmed, graceful degrade) — first run is Phase 2.
4. **Bump rule (resolved + made TOTAL in Round-3):** 0.x → **default PATCH for any releasable entry; escalate to MINOR iff any entry is `feature` or `breaking`** (so `fix`/`security`/`change`/`removed`-only releases are PATCH, never un-releasable); highest-wins; `breaking` is an orthogonal flag; switch to `breaking→MAJOR` at 1.0.0.

## Resolved Decisions (cont. — confirmed by maintainer)
5. **Defer `upgrade` to Phase 3** — CONFIRMED.
6. **`v0.1.0` anchor = `2fbf556`** — CONFIRMED.
7. **`release` bumps `dashboard/package.json`** — CONFIRMED (one atomic version source; no orphan `0.0.0`).

## Documentation Plan
- New: `CHANGELOG.md`, `.claude/skills/release/references/changelog-schema.md`, `tools/validate_changelog.py`.
- Updated: `README.md` (Updating + lib/ claim), `SETUP.md`, `CLAUDE.md`, `AGENTS.md` (parity runbook).

## Sources & References
### Origin
- **Brainstorm:** [docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md](docs/brainstorms/2026-06-07-kit-versioning-agent-upgrade-brainstorm.md). Carried forward: hybrid model; `detect`/`apply`/`default_action` core; `type`-drives-render; port-reviewed/release-automated split; `v0.1.0`→`v0.2.0`.
### Internal (verified)
- `.claude/skills/{setup-infrastructure,setup-customize,entity-rename}/SKILL.md`; `docs/solutions/tooling/entity-rename-lessons.md` (apply-safety); `Makefile` (`validate`/`deploy-dashboard`/`check-env`); `README.md` "Updating" (~203, stale claim); `.gitignore:28` (`lib/`); `config/.gitkeep`; `dashboard/package.json` (`0.0.0`); `AGENTS.md` (0 skill mentions); `docs/templates/`.
### External (prior art — deepening)
- copier `copier update` + `.copier-answers.yml`: https://copier.readthedocs.io/en/stable/updating/ · https://copier.readthedocs.io/en/stable/configuring/
- cruft + the silent version-bump bug: https://cruft.github.io/cruft/ · https://www.blenddata.nl/en/blogs/cruft-vs-copier-automating-template-updates-at-scale
- Keep a Changelog 1.1.0: https://keepachangelog.com/en/1.1.0/ · Common Changelog: https://common-changelog.org/
- SemVer (§4 major-zero): https://semver.org/ · release-please 0.x options: https://github.com/googleapis/release-please/blob/main/docs/customizing.md
- changesets: https://github.com/changesets/changesets · git-cliff: https://git-cliff.org/docs/configuration/ · Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/
- GitHub auto-release-notes: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes · codemods (closest `detect`/`apply` analog): https://nextjs.org/docs/app/guides/upgrading/codemods

---

## Appendix — Implementation Spec (Round-2 refinement)

### A. Finalized `kit-changelog.yaml` record schema

Micro-decisions: **keep `id`** (stable key the Phase-3 applied-ledger needs; can't be re-derived) · **drop `areas`** (derive from `commits`) · **keep `conditions`** as a cheap presence-gate distinct from `detect`'s relevance-gate · **add optional `detect_hint`** (generic grep/glob, advisory only, never executed, never an entity ID).

Inline self-describing block placed at the top of `kit-changelog.yaml`:

```yaml
# kit-changelog.yaml — structured source of truth. Rendered to CHANGELOG.md by `release`.
# Entries are APPEND-ONLY (release never rewrites existing entries; hand-edits tolerated).
# detect / apply / conditions are agent-INTERPRETED prose, NEVER executed as code.
schema_version: 1
schema:
  id:             "stable kebab-case slug — permanent identity; key for the Phase-3 applied-ledger; never reused/rewritten"
  version:        "semver the change first shipped in"
  type:           "fix | feature | change | removed | security — drives the CHANGELOG section ONLY"
  breaking:       "bool — orthogonal to type; drives the version bump and the [**BREAKING**] prefix"
  title:          "one-line human summary; becomes the CHANGELOG bullet"
  commits:        "short SHAs — ground-truth diff (git show); apply stays within baseline..target"
  conditions:     "PRESENCE gate (prose): does this file/feature exist in the install at all?"
  detect:         "RELEVANCE gate: agent-interpreted PROSE, never executed; the pattern that means you're affected; generic, no entity IDs"
  detect_hint:    "OPTIONAL advisory aid — { grep: <generic regex>, files: [<glob>] }; never executed, never an entity ID"
  apply:          "agent-interpreted guidance to adapt the diff to a diverged install; ground truth is commits; generic"
  default_action: "auto | ask | skip-if-absent — a CEILING the entry requests, NEVER authority to run transported files"
changes:
  - id: baseline-v0-1-0
    version: 0.1.0
    type: feature
    breaking: false
    title: "Initial release baseline"
    commits: ["2fbf556"]
    conditions: ""
    detect: ""
    apply: ""
    default_action: skip-if-absent
```

### B. `release` SKILL.md — step outline (house-style accurate)

Frontmatter: `name: release` + folded `description:` ending in `Trigger phrases: "cut a release", "release the kit", "bump the kit version", "tag a new version"`. Intro states it's **idempotent per version** and producer-only (runs inside the kit).

- **Step 0 — Prerequisites** (bash sentinels → branch): clean tree = `git diff --quiet && git diff --cached --quiet` (untracked allowed); on default branch; tags present; baseline `>= 0.1.0`; **signing-key probe** (downgrade to `git tag -a` if absent); `gh auth status` probe.
  - **0a Intent-contract gate:** scan `git log <last>..HEAD --no-merges`; flag non-Conventional/body-less releasable commits → STOP, list, ask to reword.
- **Step 1 — Collect:** range `<last>..HEAD --no-merges`. **Early exits:** empty range → "nothing to release", exit 0; (after Step 3) zero releasable entries → exit.
- **Step 2 — Curate** commits → logical changes (the only AI-judgment step; confirm grouping with user).
- **Step 3 — Derive `type`/`breaking`** deterministically from Conventional Commits; **skip-list `docs/chore/style/test/ci/refactor` — but FILE-AWARE** (Round-3 C-3): a skip-typed commit that touches a *transportable* path (`docs/templates/**`, `dashboard/src/**`, `config/**`, `.kit-version`, schema files) is NOT skipped → reclassify (default `change`). `revert:` that cancels a same-range commit → drop both (Round-3 H-1). Bot/`*(deps)` non-Conventional commits → warn-and-skip, don't STOP the release. Unclassifiable (non-bot) → blocking reword.
- **Step 4 — Compute the bump FIRST** (Round-3 C-1 reorder): default PATCH; escalate to MINOR iff any classified group is `feature` or `breaking` (0.x); highest-wins → `targetVersion`. (Was Step 5; must precede entry synthesis so `version:` is known.)
- **Step 5 — Synthesize entries** per schema A, stamping `version: <targetVersion>`; generic `detect`/`apply`; `default_action` = `ask` for behavioral fixes, `skip-if-absent` when feature-gated, `auto` only for path-safe additions. **One entry = exactly one `type`** (never merge a `fix` and a `feat`, even if they touch the same files — Round-3 M-2).
- **Step 6 — Write:** append entries (never rewrite); render `CHANGELOG.md` (KaC 1.1.0, no Unreleased, `[**BREAKING**]` prefix, compare-links); **idempotent render-check** (render-to-temp, expect zero diff); bump `.kit-version` + `dashboard/package.json`; run `tools/validate_changelog.py`.
- **Step 7 — Commit + tag:** stage by explicit path (never `git add -A`); `release: vX.Y.Z`; pre-existing-tag guard (no `-f`); signed (`-s`) or annotated (`-a`) per Step-0 probe; **transactional rollback** on post-commit failure.
- **Step 8 — Safe push:** resolve kit remote by **URL match** (`*/homeassistant-claude-kit`), display + confirm, **abort if no match (never fall back to `origin`)**; `git push <kit-remote> refs/tags/vX.Y.Z` + the release commit (never bare `--tags`); `gh release create vX.Y.Z --repo <owner>/homeassistant-claude-kit` (idempotent: skip if exists; graceful if `gh` absent).
- **Completion** blockquote + **Troubleshooting** table (TREE_DIRTY, intent-gate, nothing-releasable, render drift, schema-fail, TAG_EXISTS, no-remote-match, gh-unauth).

### C. Release correctness invariants (Round-3 red-team — authoritative)

These close the silent-wrong-output bugs; the `release` SKILL.md and `references/changelog-schema.md` must encode them:
1. **Bump is total** (C-2): default PATCH for any releasable entry; escalate to MINOR iff any entry is `feature` or `breaking`. Never "no bump" — that strands `security`/`change`/`removed`-only releases.
2. **Bump before synthesis** (C-1): compute `targetVersion` from the Step-3 classifications, THEN stamp every new entry's `version: <targetVersion>`. (The pre-fix outline forward-referenced the bump → entries got `0.1.0`/empty.)
3. **File-aware skip** (C-3, verified against `2fbf556` `docs: …templates`): never skip a `docs:`/`chore:` commit that touches a transportable path; reclassify to `change`. The skip-list is type+path, not type-only.
4. **One entry = exactly one `type`, rendered in exactly one section** (M-2, H-2): grouping merges commits only *within* a `type`; `breaking` renders as an inline `[**BREAKING**]` prefix on its type-section bullet — never its own section, never a duplicate bullet. Render-check asserts `bullet count == entry count` for the version.
5. **Revert cancellation** (H-1): a `revert:` of a same-range commit drops both (no entry, no bump contribution); a revert of a prior-release commit → `type: change`.
6. **Merge strategy pinned** (H-3): merge `feat/kit-versioning-upgrade` → `main` with `--no-ff` (preserve SHAs so `commits:` refs stay valid); never squash a branch whose commits a changelog entry references. Commit the R1 lib/-tracking fix as `change:` (a clean clone now compiles), not `chore:`.
7. **Resume-push + append-dedup** (M-1): if HEAD is already a `release: vX.Y.Z` commit whose remote tag is missing → re-run only Step 8 (push), don't re-synthesize. Before appending, skip if an entry with the same `id`/version header already exists (turns "never rewrite" into "never duplicate").

### D. Testing & Verification (condensed — see build-seq step 9)

All tests run from the kit root, no HA connection, against throwaway git state (temp clones / scratch branch with a neutralized `origin`) so nothing touches the real remote. Full runnable harness lives in `references/changelog-schema.md`.

| Area | Scenario → expected |
|------|---------------------|
| `release` dry-run (scratch branch + synthetic Conventional Commits, tag `v0.1.0`@`2fbf556`) | `feat:`→MINOR · `fix:`→PATCH · `feat!`/`BREAKING CHANGE:`→MINOR+`[**BREAKING**]` · `security:`-only→PATCH · docs/chore-only→"nothing releasable" exit 0 · empty range→no-op exit 0 · non-Conventional→intent-gate STOP · merge commit→excluded (`--no-merges`) · `revert:` of same-range→both dropped · `docs:` touching `docs/templates/**`→reclassified `change` (not skipped) |
| `validate_changelog.py` | valid fixture→pass; missing required field / bad `type` enum / bad `default_action` / non-list `changes` / non-bool `breaking`→fail with field-named error; real `kit-changelog.yaml`→pass; **drift guard**: validator keys == inline `schema:` keys |
| R1 fresh-clone gate | `git clone` temp → `cd dashboard && npm install && npx tsc -b --noEmit` exits 0 with **no setup step**; `git check-ignore -v` over all `dashboard/src/lib/**` → none ignored (incl. `adapters/`, `entities.ts`, `areas.ts`); `venv/lib/` still ignored (via `venv` rule, not line 28); `.upgrade-state.json` ignored |
| Render idempotency | render twice → byte-identical; committed `CHANGELOG.md` == fresh render of committed YAML; stable order for same-version entries (by `id`); date from tag, not `today()` |
| setup Step 10 | run twice → `.kit-version` unchanged, `commit` stamped only when empty, `version:` never rewritten; no-`.git`/ZIP → `commit: ""`, exit 0, no error |
| Signing probe | key present + dry `-s` works → `-s`; key absent or dry-sign fails → `-a` + warning, no abort; existing tag → `TAG_EXISTS` stop (no `-f`) |
