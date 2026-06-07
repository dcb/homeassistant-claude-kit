# Changelog

All notable changes to **homeassistant-claude-kit** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/). This file is **rendered** from `kit-changelog.yaml`
by the `release` skill — do not edit it by hand.

To upgrade an existing install to a newer version, run the `upgrade` skill (it reads the structured
entries in `kit-changelog.yaml` and applies the changes that are still relevant to your install).

## [0.3.0] - 2026-06-07

### Added

- Upgrade skill — consumer-side selective apply: reads `kit-changelog.yaml`, resolves the baseline (recorded-commit-first), and applies only the changes still relevant to a diverged install, on a work branch (never a blind merge). Safe by construction: an auto-apply allowlist (no upstream→RCE), secret-path guards, git 3-way merge with inline markers, per-area validation, and a resumable tracker. `detect`/`apply` are never executed. (6350d64)

## [0.2.0] - 2026-06-07

### Added

- Kit versioning + agent-driven upgrade foundation: semver, `.kit-version`, structured `kit-changelog.yaml` → rendered `CHANGELOG.md`, `tools/validate_changelog.py`, the `release` skill, and `setup-infrastructure` version stamping (009e6d2, d6df24e, 457d5bd, a09ca53)
- Irrigation core view + per-zone settings popup, replacing the placeholder stub (6b97266, 32eab02)
- Recipes (Mealie) optional template + setup guide under `docs/templates/recipes/` (dcbc8a3)

### Changed

- Track `dashboard/src/lib` generic source so a clean clone compiles (79976e8)

### Fixed

- TRV active-heating check now ignores closed valves — per-room heating counts no longer light up for a TRV idling at a low setpoint (27fd79b)

## [0.1.0] - 2026-04-03

Initial release baseline.

[0.3.0]: https://github.com/dcb/homeassistant-claude-kit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dcb/homeassistant-claude-kit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dcb/homeassistant-claude-kit/releases/tag/v0.1.0
