---
name: release
description: >
  Cut a new homeassistant-claude-kit version. Curates commits since the last tag into
  kit-changelog.yaml entries, derives the semver bump, renders CHANGELOG.md, bumps
  .kit-version + dashboard/package.json, then creates a signed tag and (confirmed)
  GitHub release. Producer-only — runs entirely inside the kit repo, reads only its own
  git history. Trigger phrases: "cut a release", "release the kit", "bump the kit
  version", "tag a new version", "run the release skill", "publish vX.Y.Z".
---

# Release the Kit

This skill is the **producer** half of kit versioning. It reads ONLY the kit's own git
history and writes the version artifacts — the git tag, `.kit-version`, `kit-changelog.yaml`,
`CHANGELOG.md`, and `dashboard/package.json` — in **one commit** so version and content always
travel together. It is **idempotent per version**: re-running it on a version that is already
released, tagged, and pushed is a no-op at every step (append-only changelog, pre-existing-tag
guard, idempotent GitHub release). The changelog's `detect`/`apply` prose is authored
generically and is **never executed**.

See `references/changelog-schema.md` for the full record schema, the intent contract, the
deterministic commit→type mapping, and the rendering rules.

## Step 0: Prerequisites

Run each check; branch on the sentinel it prints.

```bash
# Clean working tree (untracked files are allowed; tracked modifications are not)
git diff --quiet && git diff --cached --quiet && echo "TREE_OK" || echo "TREE_DIRTY"

# On the default branch
def=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -z "$def" ] && def=main
[ "$(git branch --show-current)" = "$def" ] && echo "BRANCH_OK" || echo "BRANCH_WRONG"

# A baseline tag exists and is >= v0.1.0
git fetch --tags --quiet 2>/dev/null
last=$(git tag --list 'v*' --sort=-v:refname | head -1)
[ -n "$last" ] && echo "LAST_TAG=$last" || echo "TAGS_MISSING"

# Signing capability (decides -s vs -a in Step 7)
if [ -n "$(git config --get user.signingkey)" ] && git tag -s __sigprobe__ -m x >/dev/null 2>&1; then
  git tag -d __sigprobe__ >/dev/null 2>&1; echo "SIGN_OK"
else
  git tag -d __sigprobe__ >/dev/null 2>&1; echo "SIGN_NONE"
fi

# GitHub CLI auth (for the release in Step 8)
gh auth status >/dev/null 2>&1 && echo "GH_OK" || echo "GH_NONE"
```

- **TREE_DIRTY** → stop. Tell the user to commit or stash; a release commits a curated set, never accidental WIP.
- **BRANCH_WRONG** → stop. Releases are cut from the default branch only.
- **TAGS_MISSING** → stop. The baseline `v0.1.0` tag must exist first (it is created once, during the versioning foundation). Do not invent one.
- **SIGN_NONE** → continue, but **downgrade** the Step-7 tag from `git tag -s` to `git tag -a` and log: *"no usable signing key — creating an annotated (unsigned) tag."* Never abort for this.
- **GH_NONE** → continue; in Step 8 skip `gh release create` and print the exact command for the user to run later.

### 0a. Intent-contract gate

The changelog's `detect`/`apply` can only be synthesized well if commit messages carry intent.

```bash
git log "$last"..HEAD --no-merges --pretty='%h%x09%s'
```

For each **releasable** commit (one NOT in the skip-list of Step 3), require a Conventional-Commit
subject (`^(feat|fix|change|removed|security|perf|refactor|docs|chore|style|test|ci|build)(\(.+\))?!?: `)
and a body that explains *why* / *how you'd know you're affected*.

- Bot / `*(deps)` commits that are non-Conventional → **warn and skip** (do not block the release).
- Any other releasable commit that is non-Conventional or body-less → **STOP**, list the offenders, and ask the maintainer to reword (interactive rebase) before releasing. Thin commits produce hollow `detect`/`apply`.

## Step 1: Collect commits

```bash
git rev-list --count "$last"..HEAD            # 0 → nothing new
git log "$last"..HEAD --no-merges --reverse --pretty='%h%x09%s%n%b'
```

- **Empty range** (count 0) → print *"Nothing to release since $last"* and **exit 0** (no mutation). This is the idempotent re-run case.
- Merge commits are excluded (`--no-merges`).
- For each commit, also capture its touched paths (`git show --stat --name-only <sha>`) — needed for the file-aware skip decision (Step 3) and for `conditions`/`detect_hint`.

## Step 2: Curate into logical changes

Group related commits into **one logical change each** (a feature's many commits → one entry with a
commit range; a follow-up fix to an unreleased feature folds into that feature's entry). This grouping
is the **only** step that uses judgment — everything downstream is deterministic.

**One entry = exactly one `type`.** Never merge a `fix` and a `feat` into one entry, even if they touch
the same files — emit two entries, each with its own `commits` subset, so each renders in its correct
section. Present the proposed grouping to the user for confirmation before synthesizing entries.

## Step 3: Classify each group (deterministic)

Derive `type` and `breaking` from Conventional Commits — a lookup, not judgment:

- `feat:` → `feature` · `fix:` → `fix` · `security`-tagged fix → `security` · a behavioral `refactor!`/`change:` → `change` · a removal → `removed`.
- `breaking: true` iff any grouped commit has `!` after type/scope OR a `BREAKING CHANGE:` footer (orthogonal to `type`).
- **Skip-list** (no entry, no bump contribution): `docs`, `chore`, `style`, `test`, `ci`, `refactor`, `build` — **but FILE-AWARE.** A skip-typed commit that touches a *transportable* path (`docs/templates/**`, `dashboard/src/**`, `config/**`, `.kit-version`, `kit-changelog.yaml`, the skills) is **not** skipped → reclassify it as `change`. (A `docs:` commit that edits a shipped card template is a real, transportable change.)
- **`revert:`** — if it reverts a commit **in this same `$last`..HEAD range**, drop BOTH the reverted commit and the revert (they cancel; no entry, no bump). If it reverts a prior-release commit, classify `change` (or `fix`).
- Unclassifiable non-bot commit → was already caught by the Step-0a gate.

If, after classification, there are **zero releasable entries** (e.g. everything was skip-listed), print *"N commits found but none are releasable"* and **exit 0** — no bump, no tag.

## Step 4: Compute the bump (BEFORE synthesizing entries)

The version must be known before entries are stamped. From the Step-3 classifications:

- **Default: PATCH** for any releasable entry.
- **Escalate to MINOR** iff any entry is `feature` OR `breaking` (0.x rule).
- Highest-wins → exactly one bump for the release → `targetVersion`.
- (At `>= 1.0.0`, `breaking` → MAJOR instead. Do not auto-cross 1.0.0 — that is a maintainer decision; confirm.)

So `fix`/`security`/`change`/`removed`-only releases are PATCH (never "no bump"). Confirm `targetVersion` with the maintainer.

## Step 5: Synthesize entries

For each curated group build a `kit-changelog.yaml` entry (schema in `references/changelog-schema.md`):
`id` (new stable slug), `version: <targetVersion>`, `type`, `breaking`, `title`, `commits`, `conditions`,
`detect` (+ optional generic `detect_hint`), `apply`, `default_action`.

- Write `detect`/`apply` **generically** — describe the pattern/component, never a specific entity ID.
- `default_action`: `ask` for behavioral fixes/changes; `skip-if-absent` when feature-gated; `auto` only for self-contained, path-safe additions. It is a ceiling, never authority to run transported files.

## Step 6: Write artifacts + render

1. **Append** the new entries to `kit-changelog.yaml` under `changes:`. NEVER rewrite or reorder existing entries. **De-dup:** if an entry with the same `id`, or a `## [targetVersion]` section, already exists, skip the append (idempotency).
2. **Render `CHANGELOG.md`** from `kit-changelog.yaml` (Keep a Changelog 1.1.0): `## [x.y.z] - YYYY-MM-DD` (date from the release, latest-first); sections **Added / Changed / Removed / Fixed / Security** mapped from `type`; one-line bullets with inline commit links; `[**BREAKING**]` prefix on breaking entries; **omit** an `Unreleased` section; `compare` links at the bottom. Render is deterministic (stable order by `id` within a version; no `today()`). Every entry appears in **exactly one** section.
3. **Render-check (idempotent):** render again to a temp file and diff the two — expect **zero** diff. (Do NOT use `git diff --exit-code CHANGELOG.md`, which always trips because you just wrote it.) Also assert bullet-count == entry-count for the version.
4. Bump `.kit-version` `version:` → `targetVersion`; bump `dashboard/package.json` `version` → `targetVersion`.
5. `python tools/validate_changelog.py` — abort before committing on any failure.

## Step 7: Commit + tag

```bash
# Stage ONLY the artifacts, by explicit path — never `git add -A`.
git add kit-changelog.yaml CHANGELOG.md .kit-version dashboard/package.json
git commit -m "release: vX.Y.Z"

# Pre-existing-tag guard — never -f.
git rev-parse -q --verify "refs/tags/vX.Y.Z" >/dev/null && echo "TAG_EXISTS" || echo "TAG_FREE"
```

- **TAG_FREE** → create the tag: `git tag -s vX.Y.Z -m "Release vX.Y.Z"` (or `git tag -a` if Step 0 said SIGN_NONE).
- **TAG_EXISTS** → do NOT re-tag and NEVER use `-f`; if the tag points at a different commit than the one just built, report it and stop for manual intervention; otherwise fall through to Step 8's idempotent GitHub-release check.
- **Transactional rollback:** if anything after the commit fails, roll back with `git reset --hard <pre-release-HEAD>` and `git tag -d vX.Y.Z`.

> Local creation is complete. The commit and tag exist locally; **nothing has been pushed.** The push is a separate, explicitly confirmed step.

## Step 8: Safe push + GitHub release

```bash
# Resolve the kit remote by URL match — never assume `origin`.
kit_remote=$(git remote -v | awk '/homeassistant-claude-kit(\.git)?[[:space:]].*\(push\)/{print $1; exit}')
[ -n "$kit_remote" ] && git remote get-url "$kit_remote" || echo "NO_KIT_REMOTE"
```

- **NO_KIT_REMOTE** → stop and ask. **Never** fall back to `origin` (an install's `origin` may be the user's own private config repo).
- Display the resolved URL and get confirmation. Then push the single tag + the release commit:
  ```bash
  git push "$kit_remote" "refs/tags/vX.Y.Z"
  git push "$kit_remote" HEAD:"$def"
  ```
  Never `git push --tags`; never a bare/inferred remote; never `-f`.
- **GitHub release** (skip if Step 0 said GH_NONE — print the command instead):
  ```bash
  owner_repo=$(git remote get-url "$kit_remote" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
  gh release view "vX.Y.Z" --repo "$owner_repo" >/dev/null 2>&1 \
    && echo "REL_EXISTS (skip)" \
    || gh release create "vX.Y.Z" --repo "$owner_repo" --title "vX.Y.Z" --notes-from-tag
  ```
  Idempotent: skip if the release already exists.

## Completion

> Released **vX.Y.Z**. Added N changelog entr(y/ies), bumped `.kit-version` and
> `dashboard/package.json`, rendered `CHANGELOG.md`, and pushed a signed (or annotated)
> tag to `<kit-remote-url>`. GitHub release: created / already existed / command printed.
> Re-running `release` on this version is a no-op.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `TREE_DIRTY` at Step 0 | Uncommitted tracked changes | Commit or stash; releases never sweep in WIP |
| Intent-gate lists commits | Non-Conventional / body-less releasable commits | Reword via interactive rebase before releasing |
| "Nothing to release" | HEAD is at the last tag (empty range) | Expected no-op; nothing to do |
| "none are releasable" | All commits are skip-listed (docs/chore/…) and touch no transportable path | No release needed |
| Render-check shows a diff | `CHANGELOG.md` was hand-edited | Re-render from `kit-changelog.yaml`; never edit the .md by hand |
| `validate_changelog.py` fails | Malformed/missing schema field | Fix the offending entry; re-run before committing |
| `SIGN_NONE` | No usable signing key | Annotated `-a` tag is created automatically; configure `user.signingkey` for signed tags |
| `TAG_EXISTS` | Version already tagged | Do not `-f`; if it diverges, resolve manually; else continue to the GitHub-release check |
| `NO_KIT_REMOTE` | Only a non-kit remote configured | Add/identify the kit remote explicitly; never push to `origin` blindly |
| `GH_NONE` | `gh` not authenticated | `gh auth login`, or create the release manually — the tag is already pushed |
