# Prompting Guide

How to work with Claude Code to manage your Home Assistant setup -- from simple tweaks to complex automation systems.

> **Quick reference:**
> - Simple tasks: just describe what you want in plain language
> - Reference files: *"Look at how PowerFlowCard.tsx works, follow the pattern"*
> - Complex features: use `/ce:brainstorm` then `/ce:plan` then `/ce:work`
> - Include verification: *"Test with: solar > 500W, expect charging to start"*
> - After each change: Claude validates automatically (hooks run on every edit)
> - Between unrelated tasks: `/clear` to reset context
>
> Haven't set up yet? See [SETUP.md](SETUP.md).

---

## 1. Getting Started

When you open Claude Code in this repo, it automatically reads [CLAUDE.md](CLAUDE.md) -- a file that tells Claude about the project structure, entity naming conventions, validation rules, and deployment workflow. You don't need to repeat this context; Claude already knows it.

**This guide is for you, the human.** CLAUDE.md is for the AI. This guide teaches you how to write effective prompts that produce the results you want.

### Key concepts for Claude Code users new to HA

- **Entities** are the atomic units of HA: `sensor.kitchen_temperature`, `light.living_room`, `binary_sensor.front_door_motion`. Every device exposes one or more entities.
- **Services** are actions: `light.turn_on`, `climate.set_temperature`, `automation.reload`. Claude calls these via `ha-api` or `ha-ws` over SSH.
- **Automations** are YAML rules: when X happens (trigger), if Y is true (condition), do Z (action). They live in `config/automations/*.yaml`.
- **Input helpers** (`input_number`, `input_boolean`, `input_select`) are configurable values exposed in the dashboard's Settings view. All thresholds and timeouts use these -- nothing is hardcoded.

### Key concepts for HA users new to Claude Code

- **Skills** (in `.claude/skills/`) are reusable workflows. Say "set up my home" and the setup skill runs. Say "rename entities" and the rename skill runs.
- **Hooks** (in `.claude/hooks/`) run validation automatically after every file edit. You don't need to run `make validate` manually.
- **`/clear`** resets Claude's context between unrelated tasks. Use it to prevent context pollution.
- **`/compact`** summarizes the current conversation when context gets long. Use it before switching to a new topic.

---

## 2. Simple Tasks

For straightforward changes, just describe what you want. Claude knows the project structure.

| Before (vague) | After (specific) |
|----------------|-----------------|
| *"Change the timeout"* | *"Change the normal motion timeout to 90 seconds"* |
| *"Add a sensor"* | *"Add the bathroom motion sensor to the bathroom room config in areas.ts"* |
| *"Check the kitchen light"* | *"What's the current state of light.kitchen_zone?"* |

### Example prompts

```
"Change the normal motion timeout to 90 seconds"
```

```
"Add the bathroom humidity sensor to the bathroom room in areas.ts"
```

```
"What's the current state of sensor.solar_spare_power? Use ha-api to check."
```

```
"Turn off the automatic work mode trigger — set work_mode_auto to off"
```

> **Tip:** For entity state queries, ask Claude to use `ha-api` or `ha-ws` via SSH. These tools query your live HA instance directly.

---

## 3. Intermediate Tasks

For tasks that involve multiple files or follow existing patterns, point Claude at the pattern to follow.

### Creating automations from templates

```
"Add a motion-triggered light automation for the bathroom.
Use the lighting template in docs/templates/config/automations/lighting.yaml
as the pattern. My motion sensor is binary_sensor.bathroom_motion_sensor_occupancy."
```

### Adding a dashboard card

```
"Look at how BoilerCard.tsx works, then create a similar card for the heat pump.
Follow the same pattern for entity config and state display."
```

### Modifying automation conditions

```
"The hallway motion light is too sensitive at night. Add a condition to the
hallway automation in config/automations/lighting.yaml that checks
binary_sensor.bedroom_silence_hours — if silence hours are active, don't
trigger the hallway light."
```

### Adding a room to the dashboard

```
"Add the garage as a new room in areas.ts and entities.ts.
It has: light.garage (main light), binary_sensor.garage_motion (motion),
sensor.garage_temperature (temp). Floor 0. Icon: warehouse."
```

### Batch renaming entities

```
"Run the entity-rename skill to rename my kitchen entities to follow
the domain.kitchen_descriptor convention."
```

> **Tip:** When creating components, always reference an existing example. *"Look at X, follow the pattern"* produces better results than describing the pattern from scratch.

---

## 4. Debugging and Diagnostics

Debugging is about pointing Claude at the right tool with the right context. Include three things: the **symptom**, the **timeframe**, and the **diagnostic tool**.

### Automation didn't fire

```
"The bedroom preheat automation didn't fire this morning.
Check the automation traces for climate_preheat_bedroom.
Did the trigger fire? Which condition failed?"
```

### Wrong data in charts

```
"The temperature chart for the living room shows flat lines since yesterday.
Check the entity history for sensor.living_room_temperature over the last
24 hours — was there an unavailable period?"
```

### Integration offline

```
"The Eufy cameras all show unavailable. Use ha-ws to check the state of
camera.doorbell and any related binary_sensors. Check if the integration
watchdog fired in config/automations/health.yaml."
```

### Dashboard shows stale state

```
"The dashboard shows the AC is off but HA shows it's heating. Check if
climate.living_room_ac is available via ha-ws. Then check the dashboard's
entities.ts to make sure the entity ID matches."
```

> **Tip:** Claude can check automation traces via `ha-ws raw trace/list`, entity history via the history API, and live state via `ha-ws entity get`. These are documented in [CLAUDE.md](CLAUDE.md).

---

## 5. Advanced Tasks

For complex systems involving multiple automations, physical constraints, and competing resources, provide the full picture upfront. Each topic below is an overview with a pointer to the relevant template.

### Climate zone systems

Describe the physical layout and heating hardware -- Claude can't infer this from entity IDs alone.

```
"The living room + kitchen + hallway is one open space on the ground floor,
so separated temperature control doesn't make sense. The boiler has its own
thermostat in the living room that we can't override — it controls the
radiators independently. Each room has a TRV for zone control.

Build a climate system using docs/templates/config/automations/climate.yaml
as the base. Create zones: ground_floor (living+kitchen+hallway), bedroom,
kids_room, conservatory."
```

See: `docs/templates/config/automations/climate.yaml`

### Energy management with competing consumers

When solar power is shared between multiple consumers, describe the priority logic explicitly.

```
"I have 10kW solar panels, an EV charger (6-16A), and two ACs that can heat
from solar. When there's spare power: ACs should heat first (they need less).
When there's enough for the car too, start charging. If power drops, stop
the car first, keep the ACs. Build this using the energy template."
```

See: `docs/templates/config/automations/energy.yaml`

### Activity mode state machines

Mode hierarchies (night > movie > work) need explicit priority rules.

```
"I want three activity modes: night, movie, work. Night clears everything.
Movie clears work. Work is auto-triggered by desk occupancy. Build this
using the context template. Movie mode should prompt via phone notification
when the projector turns on after sunset."
```

See: `docs/templates/config/automations/context.yaml`

### Notification systems with dedup

Notification spam is the #1 reason people disable automations. Describe your dedup requirements.

```
"I want a notification when the dishwasher finishes, but only once per cycle.
Don't re-notify if I've already been told. Reset the notification flag when
the dishwasher starts a new cycle. Use the appliance template."
```

See: `docs/templates/config/automations/appliance.yaml`

> **Tip:** For advanced tasks, use the Compound Engineering workflow below. It catches edge cases during planning that you'd otherwise discover after deployment.

---

## 6. Compound Engineering Workflow

For complex features, the [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin provides a structured five-step workflow that catches issues early and documents decisions.

This plugin is optional but recommended for complex features. Install it:
```bash
claude install-plugin https://github.com/EveryInc/compound-engineering-plugin
```

### When to use it

| Direct prompting | Compound Engineering |
|-----------------|---------------------|
| Change a timeout value | Build a new climate zone system |
| Add a sensor to a room | Create a new dashboard view |
| Fix a broken automation condition | Design a solar charging feedback loop |
| Check an entity's state | Add a multi-automation notification system |

### The cycle

| Step | Command | What it does | Iterate? |
|------|---------|-------------|----------|
| **Brainstorm** | `/ce:brainstorm` | Explore *what* to build through guided questions | Review at least once before moving on |
| **Plan** | `/ce:plan` | Create implementation plan with acceptance criteria | Deepen 1-3x, then review until solid |
| **Implement** | `/ce:work` | Execute the plan with progress tracking | |
| **Review** | `/ce:review` | Multi-agent code review | Repeat until no P1/P2 issues remain |
| **Document** | `/ce:compound` | Save the solution to `docs/solutions/` | |

**The review steps are critical.** Each round catches issues the previous one missed. Don't skip them to save time — fixing bugs after deployment costs more than catching them in review.

### Brainstorm: review before planning

After `/ce:brainstorm` produces a document, always review it at least once. Select "Review and refine" when offered. The review checks for unclear requirements, unstated assumptions, and scope creep. For complex features, review twice — diminishing returns after that.

### Plan: deepen before implementing

After `/ce:plan` creates the plan, run `/deepen-plan` to enhance each section with parallel research agents. This is the highest-leverage step in the cycle — it discovers edge cases, cross-references past solutions, and grounds the plan in real patterns.

For complex features (multi-automation systems, new dashboard views, energy management), deepen **2-3 times**. Each round adds depth from different research angles. Then review the deepened plan until no issues remain.

For simple features (adding a room, creating one automation from a template), one deepen round is sufficient.

### Review: repeat until clean

After `/ce:work` completes implementation, `/ce:review` runs multi-agent code review. **This is not optional.** The review agents catch security issues, architectural problems, performance concerns, and pattern violations that are easy to miss during implementation.

If the review finds P1 (critical) or P2 (important) issues, fix them and run `/ce:review` again. Repeat until no P1/P2 findings remain. Only then proceed to `/ce:compound`.

### Worked example: Adding climate scheduling

**Step 1 — Brainstorm + review:**
```
/ce:brainstorm I want to add per-zone temperature scheduling. Different
temperatures for morning, day, and night. Each zone should be independent.
```
Claude asks questions about zones, heating hardware, and schedule preferences. Creates a brainstorm doc. Select "Review and refine" — the review catches that you haven't specified what happens during away mode.

**Step 2 — Plan + deepen + review:**
```
/ce:plan
```
Claude detects the brainstorm, creates a plan with phases: helpers, automations, dashboard settings, testing. Run `/deepen-plan` — it discovers the climate template already handles most of this and surfaces a relevant solution doc about hysteresis. Review the deepened plan — it's solid, proceed.

**Step 3 — Implement:**
```
/ce:work
```
Claude executes the plan: creates `input_datetime` helpers, writes automation YAML, adds schedule settings to the dashboard, validates, and deploys.

**Step 4 — Review + fix:**
```
/ce:review
```
Review finds a P2: the schedule transition doesn't account for the preheat lead time. Fix it, run `/ce:review` again — clean.

**Step 5 — Document:**
```
/ce:compound
```
Claude saves the solution to `docs/solutions/` — including what worked, what didn't, and key decisions. Next time a similar feature is planned, this knowledge is automatically surfaced.

---

## 7. Effective Prompting Patterns

These patterns consistently produce better results, validated against [Anthropic's official best practices](https://code.claude.com/docs/en/best-practices).

| Pattern | Example |
|---------|---------|
| **Scope the task** | *"Fix the condition in climate.yaml line 45 that checks outdoor temperature"* |
| **Reference existing patterns** | *"Look at how PowerFlowCard.tsx works, follow the same pattern"* |
| **Provide verification** | *"Test with: solar > 500W and EV plugged in — expect charging to start"* |
| **Include physical constraints** | *"The boiler thermostat overrides software — it won't fire if its sensor reads above target"* |
| **Number your responses** | *"#1 implement now, #2 skip, #3 needs more thought, let's do only #1 and #3"* |
| **Persist knowledge** | *"Save this to docs/system-climate.md so we don't mix them up again"* |
| **Architecture first** | *"Don't make changes yet — let's design the helper structure first, then implement"* |
| **Provide the symptom** | *"The AC turns on and off every 2 minutes. Check the hysteresis values in climate.yaml"* |

### The verification pattern

The single highest-leverage thing you can do is include how to verify the result. This lets Claude check its own work.

```
"Add an automation that turns off all lights at midnight on weekdays.

Verify:
- Run make validate (should pass)
- Check the automation appears in config/automations/lighting.yaml
- The trigger should be time: '00:00:00' with a weekday condition"
```

---

## 8. Anti-Patterns and Troubleshooting

### Prompting anti-patterns

**"The Context Loss Trap"** -- After a session restart or `/compact`, don't say "yes" or "continue." Claude may have lost the specific context. Instead:
> *"Continue with Phase 2 of the climate plan — we finished the helpers, next is the automations in config/automations/climate.yaml."*

**"The Kitchen Sink Session"** -- Working on automations, then asking about the dashboard, then back to automations. Context degrades. Instead:
> Finish one topic, run `/clear`, start the next.

**"The Frustration Loop"** -- When Claude gets something wrong, don't just say "that's wrong." Include the correction:
> *"That's wrong — 50km by car is only 1 hour, but heating from 12C to 22C takes 3-4 hours. The geofence trigger won't work. We need a time-based approach instead."*

**"The Memory Assumption"** -- Don't say "remember when we discussed X." Claude doesn't remember past sessions. Instead:
> *"Check docs/system-energy.md for the solar allocation logic. Then modify the AC priority."*

**"The Interrupt Storm"** -- Don't hit Escape and re-prompt repeatedly. Let Claude finish one attempt, then redirect with the correction.

### When Claude generates wrong code

Claude sometimes produces HA code with known bugs — these aren't prompting issues, they're LLM code generation issues. The project handles this through:

- **Validation hooks** that catch syntax and entity reference errors automatically
- **`docs/solutions/`** — 35 documented patterns and pitfalls that Claude's CLAUDE.md references
- **`make validate`** — runs before every push, blocking broken configs

If Claude generates code that doesn't work, you don't need to know *why* it's wrong — just describe the symptom and Claude will check the solution docs. For example: *"The automation fires repeatedly every few seconds — check docs/solutions/ for oscillation issues."*

---

## 9. Context Management

Claude Code has a finite context window. Managing it well is the difference between productive sessions and confused ones.

**Start fresh between topics.** Run `/clear` when switching from automation work to dashboard work, or between unrelated bugs. This prevents Claude from confusing context across tasks.

**Use `/compact` strategically.** When a session gets long, `/compact` summarizes the conversation. You can guide it: `/compact "focus on the climate changes we made"`.

**Keep CLAUDE.md focused.** The project's CLAUDE.md should be under 200 lines. Longer files reduce Claude's adherence to instructions. If it grows too large, move domain-specific rules to `.claude/rules/` files with path-scoped frontmatter.

**Use subagents for investigation.** When Claude needs to read many files to answer a question, it consumes main conversation context. Ask Claude to use a subagent: *"Use a subagent to investigate how the solar allocation logic works across all the energy automations."*

**Name your sessions.** Use `/rename "climate-phase-2"` so you can resume later with `claude --resume` and pick from named sessions.

**After HA OS updates:** If `ha-api` or `ha-ws` stop working, the HA OS update reset the filesystem. Tell Claude: *"HA was updated — re-run the install script for claude-code-ha."*
