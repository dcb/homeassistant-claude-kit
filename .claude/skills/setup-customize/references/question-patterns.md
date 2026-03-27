# Question Patterns — Setup Customize

Detailed question wording and example answers for each phase of the setup interview.
Claude reads this file when running the `setup-customize` skill to get concrete
question phrasing and understand what valid answers look like.

---

## Phase 1 — Room Mapping

**Goal:** Confirm HA areas and collect basic room metadata.

### Opening

> "I found [N] areas across [M] floors in your Home Assistant. Here's the verified
> mapping from your device and entity registries:
>
> [Present table showing each room with floor, lights, motion sensors, climate, media — all from registry data]
>
> Please review this. I'll need you to confirm, correct, or skip rooms.
> Feel free to merge rooms (e.g. 'combine kitchen and storage into one zone')."

**IMPORTANT:** The opening MUST present a pre-populated table using registry data as the
primary source. For well-organized HA setups, most fields will be populated from registries.
For setups with sparse area assignments, use name-based inference as a fallback — but mark
inferred assignments with `?` and ask the user to confirm them.
Do NOT present empty/unknown fields when the data IS available in the registries.

### Per-Room Questions (only for missing data)

**Floor (only if floor registry has no data):**
> "What floor is [room name] on? (0 = ground/main, 1 = upstairs, -1 = basement)"

Example answers: `0`, `1`, `ground floor`, `first floor`
Normalize: "ground floor" → 0, "first floor" → 1 (UK), "second floor" → 1 (US), etc.

**Primary light (only if no light assigned to this room in registry):**
> "I found these lights without room assignments: [list]. Which one belongs to [room name]?"

Prefer zone/group entities over individual bulbs when both exist.

**Motion sensor (only if none found in registry for this room):**
> "I didn't find a motion sensor assigned to [room name] in the device registry.
> Does this room have one? If yes, what's the entity ID?"

**Temperature sensor (only if none found in registry):**
> "No temperature sensor found for [room name]. Is there one?"

---

## Phase 2 — Entity Specialization

### Lights

**Adaptive Lighting:**
> "Do you use the Adaptive Lighting HACS integration for [room name]? (yes/no)
> It automatically adjusts color temperature and brightness through the day."

If yes: ask for the AL switch entity (`switch.adaptive_lighting_[room]`).

**Luminance gating:**
> "Should the motion light in [room name] only turn on when it's dark?
> (Uses a lux sensor or relies on time-of-day if no sensor)"

### Climate

**Heating type:**
> "What type of heating does [room name] have?
> (A) TRV / radiator valve — I control it via a thermostat entity
> (B) AC unit — heats in winter, cools in summer
> (C) Central thermostat only — no per-room control
> (D) No heating in this room"

**TRV entity:**
> "What's the TRV climate entity for [room name]?
> (e.g. `climate.living_room_trv`)"

**AC entity:**
> "What's the AC climate entity for [room name]?
> (e.g. `climate.living_room_ac`)"

### Media

**Media player:**
> "Is there a TV or media player in [room name]?
> What's the entity ID? (e.g. `media_player.living_room_tv`)"

**Remote:**
> "Do you use a remote entity for [room name]'s TV?
> (e.g. `remote.living_room_tv` from Android TV remote integration)"

---

## Phase 3 — Domain Selection

No additional question patterns needed — this is a checkbox list presented in the skill.

---

## Phase 4 — Behavioral Interview

### Wake/Sleep Times

> "What time do you typically wake up on **weekdays**?
> (This sets `input_datetime.your_morning_work_day`)"

Example answers: `7am`, `7:00`, `07:30`

> "What time on **weekends**?"

> "What time is **bedtime** on weekdays?
> (This triggers night mode and sets `input_datetime.your_night_time_work_day`)"

> "And on weekends?"

### Presence / Occupancy

> "How many people live in the home? Do you want to track presence?
> (Presence tracking uses the HA Companion App on phones)"

If yes:
> "What are your `person.*` entity IDs?
> I'll need these for away-mode detection and person-specific alerts.
> (e.g. `person.john`, `person.jane`)"

**Do not ask about:** schedules, custody patterns, school runs, or work locations.
Presence is binary — home / not home.

### Work From Home

> "Do you work from home? (yes/no/sometimes)
> If yes, the work mode can auto-activate when you're at your desk."

If yes:
> "Is there a desk occupancy sensor?
> (e.g. a motion sensor or mmWave presence sensor near your desk)"

### Temperature Preferences

> "What's your preferred daytime temperature? (e.g. 21°C / 70°F)"
> "And at night? (e.g. 18°C / 65°F)"
> "Are there any rooms that should be kept cooler or warmer than the default?"

### Automation Sensitivities

> "Are there any automations you'd find annoying if they fired incorrectly?
> For example: 'don't turn off bedroom lights if the TV is on'"

Collect these as a list and document them in `docs/house-rules.md`.

### Notification Preferences

> "What warrants a push notification vs. a passive dashboard alert?
> For example:
> - Always notify: security alerts, integration failures, critical battery
> - Passive only: appliance done, solar reminders
> - Never during: night mode, away mode"

### Battery Threshold

> "At what battery level should I alert you about low batteries?
> (Default: 10% — applies to all Zigbee/Z-Wave devices)"

---

## Phase 5 — Notification Discovery

After listing available `notify.*` services:

> "Which notification target should I use for most alerts?
> (e.g. `notify.mobile_app_your_phone`)"

> "Any different target for critical alerts (security, failures)?
> Or use the same one?"

---

## Helpers Merge

### Option A — Keep in place

> "Got it — I'll leave your existing helpers where they are and add any missing
> ones at the bottom of `configuration.yaml`."

### Option B — Consolidate

> "I'll move all helpers to `config/helpers.yaml` and add this line to
> `configuration.yaml`:
>
> ```yaml
> homeassistant:
>   packages:
>     helpers: !include helpers.yaml
> ```
>
> Your existing values will be preserved exactly. Confirm?"

---

## Resumption Flow

When resuming from a checkpoint:

> "Welcome back! You were configuring [last completed step].
>
> Here's where we left off:
> - Rooms mapped: [list or count]
> - Domains selected: [list or 'not yet']
> - Last answer: '[last answer if available]'
>
> Want to continue from here, or start over?"

If continuing: skip to the next unanswered question.
If starting over: clear `setup-state.json` and begin from Phase 1.

---

## Common Edge Cases

**User has no areas configured in HA:**
> "I didn't find any areas in your HA instance. Let's create them manually.
> What rooms do you want to track? Just list the names."
Instruct user to add areas in HA Settings > Areas & Zones (there is no REST API for area management — it requires the WebSocket API `config/area_registry/create`).

**User has dozens of entities and isn't sure of IDs:**
Offer to search: "Let me list all [domain] entities so you can pick."
Use `entity_explorer.py --domain [domain]` or filter API results.

**User wants to skip a domain:**
Always accept "skip" or "not now" — never require completion of all domains.
Save partial state to `setup-state.json` so they can resume later.

**User's HA uses non-English entity names:**
Do not assume English naming conventions. Ask for entity IDs directly if unsure.
