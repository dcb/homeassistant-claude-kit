# Brainstorm: Kit Versioning & Agent-Driven Upgrade System

**Date:** 2026-06-07
**Status:** Draft

## What We're Building

A versioning and upgrade system for `homeassistant-claude-kit` so that installs (which diverge heavily after setup) can pull in later fixes and features *selectively*, driven by a coding agent (Claude/Codex). The system has a producer side (how new versions are cut + changelog generated) and a consumer side (how an existing install upgrades).

### Deliverables

1. **Versioning scheme** — semver with kit-specific meaning: PATCH = bug fix to shipped code, MINOR = additive/opt-in feature, MAJOR = change that needs migration in installs.
2. **`.kit-version` anchor** — a file in every install recording which kit version it's based on; `setup` stamps it on first install; the `upgrade` skill bumps it.
3. **Retroactive baseline tag** — tag current `main` (`fc0db17` lineage) so there's a real diff baseline in history. Proposed `v0.1.0`.
4. **`kit-changelog.yaml`** — structured, machine-readable changelog at repo root; the single source of truth.
5. **`CHANGELOG.md`** — human-readable release notes, *rendered from* `kit-changelog.yaml` (not hand-maintained).
6. **`release` skill** — automated; operates only on the public kit; generates changelog entries, bumps version, renders `CHANGELOG.md`, tags `vX.Y.Z`.
7. **`upgrade` skill** — ships in the kit; an install uses it to fetch the kit upstream and selectively apply relevant changes.
8. **Setup wires the `upstream` remote** — so git-as-transport works for upgrades.

## Why This Approach

The core insight: **git and the changelog answer different questions.** Git (via an `upstream` remote) is the precise "what changed" transport — `git diff vX..vY` gives exact bytes, better than any prose. The changelog is the "is this relevant *here*, and should I apply it" intent layer on top. A blind `git merge` would be a disaster because installs diverge hard (real entity IDs in `entities.ts`, deleted views, customized automations). So the agent *walks* the diff and decides per-change: apply / skip / ask.

This is a **hybrid**: git upstream merge as transport + agent-driven selective apply as the decision layer. It directly realizes the user's framing — *if the issue is still present in the local install, the fix gets pulled in.*

## Key Decisions

1. **Hybrid upgrade model.** Git upstream remote = transport (ground-truth diffs); agent-driven selective apply = decision layer (relevance + application). Not a blind merge.

2. **Explicit `.kit-version` anchor** (not just git merge-base). Survives messy install histories and the case where someone never set up the upstream remote. KISS: holds the semver string; the upstream remote supplies the repo URL.

3. **Structured YAML is the source of truth; `CHANGELOG.md` is rendered.** "Richer machine-readable" without maintaining two drifting docs.

4. **Per-change record schema.** Each entry is one *logical* change:
   ```yaml
   - id: fix-trv-heating-count-closed-valves   # stable slug
     version: 0.2.0
     type: fix                                  # fix | feature | change | removed
     title: "RoomCard counted closed TRV valves as actively heating"
     areas: [dashboard/src/components/cards/RoomCard.tsx]
     commits: [3f38425, 904cbaa]                # ground-truth diff
     conditions: "Only if your dashboard includes RoomCard / climate room views."
     detect: >                                  # how the agent knows you're affected
       Heating count derived from hvac_action/state == 'heat' WITHOUT checking
       valve position, so a closed-valve TRV still counts as heating.
     apply: >                                   # what to do about it
       Switch to the active-heating check that also verifies the valve is open
       (see referenced commits). Adapt entity names to the local install.
     default_action: ask                        # auto | ask | skip-if-absent
   ```
   The hand-valuable fields are `detect` / `apply` / `default_action` — the agent-facing core. `type`/`version`/`areas`/`commits` are cheap or derivable. `commits` lets the upgrade agent pull the real diff for precision rather than trusting prose.

5. **`type` is the single driver** of both the semver bump and the rendered `CHANGELOG.md` section (fix→PATCH→"Fixed", feature→MINOR→"Added", change/removed→possibly MAJOR→"Changed"/"Removed").

6. **Port = collaborative, Release = automated.** Porting private→public (selecting kit-worthy commits, stripping real entity IDs / house-specific logic, generalizing components) is always agent-proposes / user-reviews — this is the part that previously caused a cross-repo clobber incident. Releasing (changelog gen, version bump, render, tag) is automated and runs entirely inside the public kit.

7. **The intent contract.** The `release` skill can only auto-write good `detect`/`apply` if the **port commits carry the intent** (why + how-you'd-know-affected, in generic terms). So port commit messages are written with that in mind; the skill synthesizes entries from commit messages + diffs. No hand-writing of the changelog.

8. **`release` skill ships in the kit and is single-repo.** It reads only the public kit's own history, so any forker/contributor can use it. The maintainer's private→public porting is an extra step done *before* invoking it; the skill needs no private-repo access.

9. **Author generically.** `detect`/`apply` describe the pattern/component, never a specific entity ID — installs differ. Same discipline as the original genericization.

## Sequencing (two plans)

- **Phase 1 — Foundation (on the kit as-is):** baseline tag `v0.1.0`; `.kit-version` anchor + setup stamping + `upstream` remote wiring; define `kit-changelog.yaml` schema; write the `release` and `upgrade` skills. Changelog starts ~empty.
- **Phase 2 — First real release (dogfood):** port the recipes feature, irrigation refresh, and the fix backlog; run the new `release` skill to cut `v0.2.0` with a fully populated changelog. This validates the whole pipeline on real material.

Machine-first so the recipes/irrigation/fixes sync becomes the proof that the upgrade path works.

## Deferred to Planning

- **Baseline version number.** Recommend `v0.1.0` baseline → `v0.2.0` first sync (0.x = still stabilizing). User could opt for `1.0.0` if the kit is considered production-stable.
- **`.kit-version` format.** Start as a bare semver string (KISS); could grow to a small manifest (version + last-upgraded date) later.
- **GitHub Releases.** Optional: have the `release` skill also `gh release create` with the rendered notes.
- **Upgrade skill UX details.** How it summarizes applied/skipped/asked changes; how it runs the kit's existing validators + dashboard typecheck after applying.
- **Exact drift between public `IrrigationView` and the private version** — public already ships irrigation; confirm at port time whether it needs a refresh or is current.
