# homeassistant-claude-kit

A fully custom Home Assistant setup -- automation templates, mobile-first React dashboard, and AI-guided configuration -- built and managed entirely through Claude Code.

<p align="center">
  <img src="docs/images/home.png" width="195" alt="Home -- room cards, weather, modes, media">
  <img src="docs/images/climate.png" width="195" alt="Climate -- zone cards with temperature charts">
  <img src="docs/images/energy.png" width="195" alt="Energy -- power flow, EV charger, solar priority">
  <img src="docs/images/security.png" width="195" alt="Security -- camera grid with battery badges">
</p>
<p align="center"><em>Home &nbsp;·&nbsp; Climate zones &nbsp;·&nbsp; Energy &amp; EV charging &nbsp;·&nbsp; Security cameras</em></p>

## Why This Exists

**The problem with Lovelace.** It's great for quick device control, but its card model is centered around individual devices and rooms. Real home automation is more nuanced -- you don't control a boiler directly, you set a heating schedule with climate zones that don't always map 1:1 to rooms (an open-plan ground floor is one zone, not four). You want manual overrides per zone when needed, but the system should coordinate the boiler with the TRVs automatically, driven by temperature sensors. When there's spare solar power, the ACs should heat opportunistically -- again with manual override when you want it. Lovelace doesn't give you this level of control over the interface or the logic behind it.

**What made it possible.** This entire system -- 70+ automations, a custom React dashboard, validation tooling, entity management -- was built from scratch in two weeks by one person using [Claude Code](https://claude.com/claude-code). There is no visual editor for the dashboard; it's custom React code. There is no UI for editing automations; everything lives in YAML files managed through Claude Code. You describe what you want in plain language, and the AI writes the code, validates it, deploys it, and documents it. Yes, there are risks in AI-generated code, but they are mitigated by validation at every step (pre-push hooks, TypeScript checks, entity reference validation), a structured workflow that catches issues early ([Compound Engineering](PROMPTING-GUIDE.md#6-compound-engineering-workflow)), and tight integration with HA through CLI tools that eliminate manual copy-paste and command-running.

The result outweighs the risks by far: a system that would have taken months to build manually, working exactly the way you want it, fully documented, and continuously improvable through the same AI workflow that built it.

## Design Principles

- **Use-case driven, not device-driven.** The dashboard and automations are organized around how you use your home -- climate zones, activity modes, energy management -- not around individual devices or integrations.
- **Nothing hardcoded.** Every threshold, timeout, temperature, brightness, and duration is an `input_*` helper, visible and editable in the Settings view. Automations read these at runtime -- no magic numbers, everything tweakable without touching YAML.
- **Self-documenting.** `docs/system-*.md` describes what IS (hardware, entities, design decisions -- generated during setup, populated as you build). `docs/solutions/` captures debugging lessons (34 docs and growing). Both are updated as part of every change, so documentation never drifts from reality.
- **Mobile-first.** The dashboard is designed for phones. Every interaction is touch-optimized. When a design compromise was needed, mobile experience was favored over desktop.
- **Validate before deploy.** Hooks run on every file edit. `make push` validates before syncing. Broken configs never reach HA.
- **Event-driven, not polling.** Automations use state triggers with `for:` durations, not timers or delays. The system reacts to changes rather than checking on intervals.

## Quick Start

> **You'll need:** SSH access to HA, a long-lived token, Python 3.12+, rsync -- see [SETUP.md](SETUP.md) for details.

```bash
git clone https://github.com/dcb/homeassistant-claude-kit
cd homeassistant-claude-kit
cp .env.example .env   # Fill in HA_HOST, HA_URL, HA_TOKEN, SSH_USER
make setup             # Python venv + dependencies
```

Then open Claude Code in the repo and say **"set up my home"**. That's it -- Claude handles the rest.

**New here?** [SETUP.md](SETUP.md) (prerequisites) --> [PROMPTING-GUIDE.md](PROMPTING-GUIDE.md) (how to use)

| You do (once) | The kit handles (always) |
|---------------|------------------------|
| Install SSH add-on + create token | Validate before every push |
| Fill in `.env` | Discover entities from HA registries |
| Open Claude Code, say "set up my home" | Generate dashboard + automation config |

<details>
<summary>Table of Contents</summary>

- [Why This Exists](#why-this-exists)
- [Design Principles](#design-principles)
- [Quick Start](#quick-start)
- [How to Use This Kit](#how-to-use-this-kit)
- [What's Included](#whats-included)
- [Project Structure](#project-structure)
- [Available Commands](#available-commands)
- [Architecture](#architecture)
- [Acknowledgments](#acknowledgments)

</details>

## How to Use This Kit

**Just talk to Claude** (most users) -- Describe what you want in plain language. Claude reads the project's [CLAUDE.md](CLAUDE.md) automatically and knows the entity naming conventions, validation rules, and deployment workflow. See the **[Prompting Guide](PROMPTING-GUIDE.md)** for examples from simple tasks to complex automations.

**Learn the patterns** (power users) -- For complex features, use the [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) workflow: `/ce:brainstorm` to explore what to build, `/ce:plan` to design it, `/ce:work` to implement, `/ce:compound` to document the solution. Review `docs/solutions/` for known anti-patterns before starting. Read `docs/system-*.md` for your domain before modifying automations.

**Do it yourself** (manual) -- All `make` commands and YAML templates are documented. You can edit files directly, validate with `make validate`, and deploy with `make push`. Initial entity discovery and dashboard config generation are easier with Claude Code, but everything else works without it.

## What's Included

### Automation Templates

Templates in `docs/templates/config/` -- copied and customized during setup.

| Domain | File | What It Does |
|--------|------|-------------|
| Climate | `climate.yaml` | TRV zone control, adaptive preheat, day/night schedules |
| Energy | `energy.yaml` | Solar EV charging feedback loop, overnight decisions, session summaries |
| Lighting | `lighting.yaml` | Motion lights with AL integration, movie/night/work modes, porch twilight |
| Context | `context.yaml` | Mode hierarchy, notification dedup, TV sleep timers |
| Health | `health.yaml` | Integration watchdogs with retry, stale sensors, battery alerts |
| AC | `ac.yaml` | Solar-driven AC heating, manual mode bypass with auto-revert |
| Appliance | `appliance.yaml` | WiFi appliance state machine, cycle tracking, solar reminders |

### Dashboard

React 19 + TypeScript + Tailwind v4, deployed as an HA `panel_custom` via `make deploy-dashboard`.

<p align="center">
  <img src="docs/images/room-popup.png" width="195" alt="Room popup -- light brightness and color temp sliders, climate zone, media">
  <img src="docs/images/ac-popup.png" width="195" alt="AC control -- temperature stepper, mode/fan/swing, manual override timer">
  <img src="docs/images/remote.png" width="195" alt="TV remote -- touchpad, app strip, media controls, volume slider">
  <img src="docs/images/settings.png" width="195" alt="Settings -- schedules, temperature presets, motion timeouts">
</p>
<p align="center"><em>Room controls &nbsp;·&nbsp; AC popup &nbsp;·&nbsp; TV remote &nbsp;·&nbsp; Settings (every value is configurable)</em></p>

- Room cards with temperature, humidity, motion, light status
- Bottom-sheet popups with light sliders, climate controls, media players
- Camera streams (MSE on desktop, WebRTC on mobile/iOS) with snapshot history
- EV charger card with solar/fast/manual modes and charging cost breakdown
- Unified control system with 4-phase state machine: debounce, inflight tracking, post-confirmation hold

See [dashboard/CLAUDE.md](dashboard/CLAUDE.md) for the full development guide.

### Health Monitoring & Charts

<p align="center">
  <img src="docs/images/health.png" width="250" alt="Health -- boiler diagnostics, heating timeline, per-zone temperature charts">
  <img src="docs/images/energy-chart.png" width="250" alt="Energy chart -- solar production, house/charger consumption, forecast, cost">
</p>
<p align="center"><em>Boiler diagnostics &amp; heating timeline &nbsp;·&nbsp; Solar production with charging breakdown</em></p>

- Heating timeline showing boiler and per-zone activity over the day
- Per-zone temperature charts with target lines and TRV calibration offsets
- Solar production chart with house/charger/forecast overlays and daily cost breakdown
- Integration health status with watchdog retry history

### Validation Tools

```bash
make validate   # Runs all three layers:
                # 1. YAML syntax validation
                # 2. Entity reference checking
                # 3. Official HA configuration validation
```

Pre-push hooks block broken configs automatically. Template placeholder IDs (`your_*`) are skipped.

### Entity Rename Skill

Batch rename HA entities to follow a consistent `domain.{room}_{descriptor}` convention:

```
entity-rename   # Discover → propose → approve → execute → verify
```

Uses `ha-ws` (WebSocket API via SSH) for renames, then updates all YAML and TypeScript references automatically. Tracks every rename in `entity-renames.json` for rollback safety.

### Institutional Knowledge

34 solution docs in `docs/solutions/` covering common HA pitfalls: Jinja2 scoping bugs, watchdog patterns, automation mode traps, dashboard timing issues, API gotchas, and more. These are automatically surfaced by the planning workflow to prevent repeating past mistakes.

## Project Structure

```
config/                    # HA config files (synced via rsync)
  automations/             # Split automation files by domain
  scripts/                 # Split script files
  configuration.yaml       # Main config + input helpers
dashboard/                 # React 19 custom panel
  src/components/          # Cards, controls, popups, layout
  src/hooks/               # useHistory, useWeatherForecast, useGo2RtcStream
  src/lib/                 # entities.ts, areas.ts, control hooks
  src/views/               # Home, Climate, Energy, Security, Settings, Health
docs/
  templates/config/        # Automation YAML templates
  solutions/               # 34 debugging lessons and patterns
  system-*.md              # System documentation (always current)
  brainstorms/             # Feature exploration documents
  plans/                   # Implementation plans
tools/                     # Validation and entity management scripts
.claude/
  skills/                  # AI skills (setup-infrastructure, setup-customize, entity-rename)
  hooks/                   # Pre/post tool-use validation hooks
Makefile                   # pull, push, validate, deploy-dashboard
```

## Available Commands

| Command | What it does |
|---------|-------------|
| `make pull` | Pull latest config from HA |
| `make push` | Validate + push to HA + reload |
| `make diff` | Dry run -- preview what push would sync |
| `make validate` | Run all validation tests |
| `make backup` | Create timestamped backup |
| `make entities` | Explore available HA entities |
| `make deploy-dashboard` | Build + deploy React dashboard to HA |

## Architecture

Configuration flows through an rsync-based pipeline:

1. **Edit locally** -- YAML files in `config/`, React components in `dashboard/`
2. **Validate** -- hooks run on every file edit (YAML syntax, entity refs, TypeScript)
3. **Push** -- `make push` syncs to HA via rsync over SSH (`.storage/` is protected)
4. **Reload** -- automations, scripts, and templates reload without HA restart

The dashboard is a standalone React app served as a `panel_custom` iframe. It connects to HA via WebSocket (embedded auth when in HA, token auth in dev mode).

## Acknowledgments

This project builds on the work of others:

- **[philippb/claude-homeassistant](https://github.com/philippb/claude-homeassistant)** -- Makefile, rsync workflow, validation tools, CLAUDE.md structure, and the original vision of AI-managed HA config
- **[danbuhler/claude-code-ha](https://github.com/danbuhler/claude-code-ha)** -- `ha-api` and `ha-ws` CLI tools for querying HA state, managing the entity/device/area registries, and renaming entities via WebSocket -- all from the HA instance over SSH
- **[shannonhochkins/ha-component-kit](https://github.com/shannonhochkins/ha-component-kit)** -- `@hakit/core` provides the React WebSocket connection and entity state hooks that power the dashboard
- **[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin)** -- the Claude Code plugin that powers the brainstorm → plan → implement → review → learn workflow
- **[Home Assistant](https://www.home-assistant.io/)** -- the platform
- **[Claude Code](https://claude.com/claude-code)** -- the AI development tool

## License

MIT -- see [LICENSE](LICENSE)
