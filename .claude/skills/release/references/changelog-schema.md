# Changelog schema, intent contract, and rendering rules

Reference for the `release` skill. The source of truth is `kit-changelog.yaml` at the repo root;
`CHANGELOG.md` is **rendered** from it and never hand-edited. `tools/validate_changelog.py` enforces
the field contract (and guards against drift between the enforced fields and the file's inline
`schema:` block).

## Per-change record

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Stable kebab-case slug — permanent identity; the key the Phase-3 `upgrade` applied-ledger uses. Never reused or rewritten. |
| `version` | yes | The semver this change first shipped in (= the release's `targetVersion`). |
| `type` | yes | `fix \| feature \| change \| removed \| security`. Drives the rendered CHANGELOG **section only**. |
| `breaking` | yes | Boolean, **orthogonal** to `type`. Drives the version bump and the `[**BREAKING**]` render prefix. |
| `title` | yes | One-line human summary; becomes the CHANGELOG bullet. |
| `commits` | yes | List of short SHAs — the **ground-truth diff** (`git show`). `apply` must stay within `baseline..target`. |
| `conditions` | no | **Presence gate** (prose): does this file/feature exist in the install at all? Cheap short-circuit before `detect`. |
| `detect` | no | **Relevance gate**: agent-interpreted PROSE, **never executed** — the pattern that means "you're affected." Generic, no entity IDs. |
| `detect_hint` | no | OPTIONAL advisory aid `{ grep: <generic regex>, files: [<glob>] }`. Never executed, never an entity ID. |
| `apply` | no | Agent-interpreted guidance to adapt the diff to a diverged install. Ground truth is `commits`. Generic. |
| `default_action` | yes | `auto \| ask \| skip-if-absent`. A **ceiling** the entry requests — never authority to run transported files. |

`conditions` vs `detect`: `conditions` asks *does this even exist here* (file/feature presence); `detect`
asks *given it exists, is the buggy/old pattern still present* (not already locally fixed). The two-stage
funnel is what lets `upgrade` (Phase 3) skip both never-installed features and already-fixed bugs.

## The intent contract (why commit messages matter)

`release` synthesizes `detect`/`apply` from commit messages + diffs. Good entries require good commits:

- Use **Conventional Commits** (`feat:`, `fix:`, `change:`, `security:`, `!`/`BREAKING CHANGE:` for breaking).
- The body should state **why** the change was made and **how an install would know it's affected** — in
  generic terms (component/pattern), never a specific entity ID.
- Commit-message anti-patterns to fix before releasing: using `chore:` for a user-facing change (it's
  probably `feat`/`fix`); forgetting the `!`/`BREAKING CHANGE:` marker on a rename/removal; body-less
  one-liners for non-trivial changes. The Step-0a gate flags these.

## Bump rule (0.x)

Default **PATCH** for any releasable entry; escalate to **MINOR** iff any entry is `feature` or `breaking`;
highest-wins (one bump per release). This is **total** — `fix`/`security`/`change`/`removed`-only releases
are PATCH, never "no bump." Compute the bump **before** synthesizing entries so each entry's `version:` is
the computed target. At `>= 1.0.0`, switch to `breaking` → MAJOR (a deliberate maintainer decision).

## Classification (commit → type), file-aware

- `feat:`→`feature`, `fix:`→`fix`, `security`-tagged→`security`, behavioral `change:`/`refactor!`→`change`, removal→`removed`.
- Skip-list (no entry, no bump): `docs`, `chore`, `style`, `test`, `ci`, `refactor`, `build` — **unless** the
  commit touches a transportable path (`docs/templates/**`, `dashboard/src/**`, `config/**`, `.kit-version`,
  `kit-changelog.yaml`, `.claude/skills/**`), in which case reclassify as `change`.
- `revert:` of a same-range commit → drop both (cancel). `revert:` of a prior release → `change`.
- Bot / `*(deps)` non-Conventional commits → warn-and-skip, never block the release.

## Rendering rules (Keep a Changelog 1.1.0)

- Version header `## [x.y.z] - YYYY-MM-DD` (ISO date from the release/tag, **not** `today()`); latest version first.
- Section order within a version: **Added → Changed → Removed → Fixed → Security**, mapped from `type`
  (`feature`→Added, `change`→Changed, `removed`→Removed, `fix`→Fixed, `security`→Security).
- One-line bullets: `- <title> ([abc1234])` with inline commit links.
- `[**BREAKING**]` prefix on bullets whose entry has `breaking: true`. `breaking` is **only** a prefix —
  it never creates its own section and never duplicates the bullet. Every entry renders in exactly one section.
- No `Unreleased` section (the skill computes "what's unreleased" from `git log <lastTag>..HEAD` on demand).
- Bottom of file: `compare` links, e.g. `[0.2.0]: https://github.com/dcb/homeassistant-claude-kit/compare/v0.1.0...v0.2.0`.
- Deterministic: entries with the same `version` render in stable `id` order; rendering twice is byte-identical.

## Example entry

```yaml
- id: trv-heating-count-ignores-valve-position
  version: 0.2.0
  type: fix
  breaking: false
  title: "RoomCard counted closed-valve TRVs as actively heating"
  commits: [3f38425, 904cbaa]
  conditions: "Only if your dashboard includes a RoomCard / climate room view with a heating count."
  detect: >
    The heating count is derived from hvac_action / state == 'heat' WITHOUT checking valve
    position, so a TRV reporting heat with a closed valve is still counted as heating.
  detect_hint:
    grep: "hvac_action|state\\s*===?\\s*['\"]heat['\"]"
    files: ["dashboard/src/components/**/RoomCard.*"]
  apply: >
    Add the valve-open check to the active-heating predicate (see commits). Adapt the climate
    entity references to your local install; do not copy entity IDs verbatim.
  default_action: ask
```
