# System: Irrigation

HA-primary lawn/garden irrigation: Home Assistant owns all scheduling, skip
logic, cycle-and-soak sequencing, and notifications. Your valve controller
(Hydrawise / OpenSprinkler / Rachio / …) is treated as a dumb valve actuator.

> This is a **template/reference** describing what the irrigation automations and
> helpers do. Replace the placeholders (zone slugs, `your_*` entities) with your
> real setup. The shipped templates ship two example zones — `front_zone_1` and
> `back_zone_1` — matching the dashboard's `IRRIGATION_ZONES` in
> `dashboard/src/lib/entities.ts`.
>
> Files:
> - `docs/templates/config/automations/irrigation.yaml` — the 9 automations
> - `docs/templates/config/helpers.yaml` — `# --- Irrigation ---` helper section
> - `dashboard/src/lib/entities.ts` — `IRRIGATION_*` constants + `IRRIGATION_ZONES`

## Hardware (fill in your own)

- **Controller**: your valve controller (Hydrawise / OpenSprinkler / Rachio / …),
  treated as a dumb valve actuator. HA owns scheduling; the controller's own
  smart schedules are disabled.
- **Sprinkler heads**: rotors / spray heads per zone
- **Zones**: N (this template ships 2 examples)
- **Water source**: well / mains (metering/cost is out of scope here)
- **Rain sensor**: optional; HA uses weather data for skip logic instead

## Architecture

HA owns all scheduling decisions. The controller's smart schedules are disabled —
it only opens/closes valves on HA command. The per-zone "run for N minutes"
service in the templates is `hydrawise.start_watering` (targets
`binary_sensor.{slug}_watering`). **Replace this with your controller's
equivalent timed-run service.** If your controller has no timed-run service, use
`valve.open_valve` on `valve.{slug}` + a `delay:` + `valve.close_valve`.

Weather data drives skip logic — see **Weather Data Layer** below.

**Key constraint**: most cloud controllers do NOT honor cycle-and-soak settings
on a manual/API start — HA manages soak cycles itself via sequential
start/wait/delay sequences.

**Controller connectivity (optional)**: `binary_sensor.irrigation_connectivity`.
If your controller exposes an online/offline sensor, the scheduler performs an
inline reload-recovery before giving up. If you have no such sensor, delete the
connectivity recovery block and the mid-run valve reload step.

## Zone Map (example — replace with your zones)

| Entity ID | Name | Group | Base Runtime |
|---|---|---|---|
| `valve.front_zone_1` | Front Zone 1 | Front | 5 min |
| `valve.back_zone_1` | Back Zone 1 | Back | 5 min |

Tune base runtimes after a catch-cup test for your sprinklers/soil.

### Per-Zone Entities

Each zone derives all its entity IDs from its **slug** (must match the helpers,
the automations, and `IRRIGATION_ZONES` in the dashboard):

- `valve.{slug}` — open/close control (from your controller)
- `binary_sensor.{slug}_watering` — currently running (target for the timed-run
  service)
- `sensor.{slug}_remaining_watering_time` — optional, minutes left in current run

Depending on your integration, the controller may also expose next-cycle, daily
total, and smart-schedule on/off entities — not used in HA-primary mode.

## Scheduling

### Group Staggering

Zones split into Front/Back groups so a run fits in a short morning window. The
scheduler waters one group per run based on `input_select.irrigation_frequency`:

| Frequency | Behavior |
|-----------|----------|
| `every_other_day` | alternates Front/Back by day-of-year |
| `every_2_days` | Front, Back, none (3-day cycle) |
| `every_3_days` | Front, Back, none, none (4-day cycle) |
| `daily` / heat wave | Both groups every day |
| `manual_only` | scheduler never auto-runs (manual triggers only) |

### Watering Window

- **Start**: `input_number.irrigation_start_time_hour` +
  `irrigation_start_time_minute` (default 05:00)
- **Hard stop**: `input_number.irrigation_end_hour` (default 08:00) — safety
  cutoff so watering never overruns into a window where sprinklers are at risk
  (people/pets in the yard, etc.)

### Cycle-and-Soak

Configurable per zone. Clay or sloped soil may need multiple short cycles with
soak pauses to prevent runoff. Each zone has:

- `irrigation_zone_{slug}_cycle_minutes` — duration of one cycle
- `irrigation_zone_{slug}_cycles` — number of cycles (1 = no soak)
- `irrigation_zone_{slug}_soak_minutes` — pause between cycles
- `irrigation_zone_{slug}_seasonal_pct` — percentage adjustment

Effective per-cycle runtime = `max(1, round(cycle_minutes × seasonal_pct / 100))`,
repeated for `cycles` count with `soak_minutes` pauses. (Mirrored in the
dashboard's `effectiveCycleMinutes()`.)

## Weather Data Layer

These sensors are **prerequisites you create** (template / REST / statistics
sensors in your `configuration.yaml`). The irrigation automations only consume
them. Source them from any weather integration you have (Met.no, Open-Meteo,
OpenWeatherMap, a local weather station, etc.).

### Sources (suggested — adapt to your integrations)

| Entity | Data |
|--------|------|
| `sensor.irrigation_rain_yesterday` | Actual rain yesterday (mm) |
| `sensor.irrigation_rain_today` | Actual rain today (mm) |
| `sensor.irrigation_rain_forecast_tomorrow` | Forecast rain tomorrow (mm) |
| `sensor.irrigation_precip_forecast_24h` | Sum of next-24h forecast precip (mm) |
| `weather.your_forecast` (`wind_speed` attr) | Current wind (km/h) |
| `sensor.your_outdoor_temperature` | Actual outdoor temp (°C) |
| `sensor.your_outdoor_temperature_daily_max` | Daily max temp (heat-wave detection) |
| `sensor.outdoor_temperature_3_day_average` | 3-day rolling avg temp (seasonal cold) — **prerequisite**, see below |

**`sensor.outdoor_temperature_3_day_average` prerequisite**: build a rolling
3-day average of your outdoor temperature with a `statistics` sensor (mean over
3 days) or a template over the outdoor-temp history. Do **not** assume any
specific weather provider — wire it to whatever temperature sensor you have.

### Skip Logic (template binary_sensors you create)

| Binary Sensor | Condition | Default Threshold |
|---|---|---|
| `binary_sensor.irrigation_skip_rain_forecast` | 24h forecast > threshold | `input_number.irrigation_rain_skip_mm` (5 mm) |
| `binary_sensor.irrigation_skip_rain_actual` | 48h actual rain > threshold | `input_number.irrigation_rain_history_skip_mm` (8 mm) |
| `binary_sensor.irrigation_skip_wind` | Current wind > threshold | `input_number.irrigation_wind_skip_kmh` (25 km/h) |
| `binary_sensor.irrigation_skip_freeze` | Current temp < freeze threshold | `input_number.irrigation_freeze_temp` (4 °C) |
| `binary_sensor.irrigation_skip_seasonal_cold` | 3-day rolling avg < threshold (grass dormant) | `input_number.irrigation_seasonal_cold_temp` (8 °C) |
| `binary_sensor.irrigation_skip_any` | OR of all above | — |

All thresholds are exposed as `input_number` helpers (no magic numbers).

**Critical**: do not silently default rain sensors to `0` when they're
unavailable. If your weather source drops out, the skip sensors should evaluate
to `false` (= water when unsure) rather than fabricating a "no rain" reading.

## Input Helpers

All defined in the `# --- Irrigation ---` section of
`docs/templates/config/helpers.yaml`.

### Global

| Helper | Type | Default |
|--------|------|---------|
| `input_boolean.irrigation_enabled` | boolean | ON |
| `input_boolean.irrigation_heat_boost` | boolean | OFF |
| `input_boolean.irrigation_manual_stop` | boolean | OFF |
| `input_boolean.irrigation_run_now` | boolean | OFF |
| `input_select.irrigation_frequency` | select | every_other_day |
| `input_number.irrigation_pause_days` | number | 0 |
| `input_number.irrigation_rain_skip_mm` | number | 5 |
| `input_number.irrigation_rain_history_skip_mm` | number | 8 |
| `input_number.irrigation_wind_skip_kmh` | number | 25 |
| `input_number.irrigation_freeze_temp` | number | 4 |
| `input_number.irrigation_seasonal_cold_temp` | number | 8 |
| `input_number.irrigation_start_time_hour` | number | 5 |
| `input_number.irrigation_start_time_minute` | number | 0 |
| `input_number.irrigation_end_hour` | number | 8 |

### Per-Zone (duplicate per zone, swapping the slug)

For each zone (slug = `front_zone_1`, `back_zone_1`, … your real slugs):

| Helper | Type | Range | Default | Purpose |
| --- | --- | --- | --- | --- |
| `input_boolean.irrigation_zone_{slug}_enabled` | boolean | on/off | on | Include zone in scheduled runs |
| `input_boolean.irrigation_zone_{slug}_manual_run` | boolean | on/off | off | Dashboard single-zone Start trigger |
| `input_boolean.irrigation_zone_{slug}_running` | boolean | on/off | off | Running sentinel (see below) |
| `input_number.irrigation_zone_{slug}_cycle_minutes` | number | 0.5–60, step 0.5 | per zone | Duration of one cycle |
| `input_number.irrigation_zone_{slug}_cycles` | number | 1–5, step 1 | 1 | Number of cycles per run |
| `input_number.irrigation_zone_{slug}_soak_minutes` | number | 5–60, step 5 | 20 | Pause between cycles |
| `input_number.irrigation_zone_{slug}_seasonal_pct` | number | 10–200, step 5 | 100 | Per-zone runtime % adjustment |
| `input_select.irrigation_zone_{slug}_group` | select | front/back | per zone | Group rotation membership |

The daily scheduler captures every zone's helpers **once** at run start, so edits
made during an active run apply to the *next* run.

**Running sentinel** (`input_boolean.irrigation_zone_{slug}_running`): single
source of truth for "this zone is part of an active watering session (including
soak between cycles)". Set by the daily scheduler and manual-run automation at
the top of each zone block; cleared at the bottom. Cleared en masse by manual
stop, weather abort, and hard stop. The dashboard reads it for the Start↔Stop
button flip and elapsed-time display; the cycle loop gates each iteration on it,
so clearing it aborts the zone mid-run.

### Manual Full-Day Run

`input_boolean.irrigation_run_now` — dashboard "Run now" button. Triggers
`irrigation_daily_scheduler` outside the configured start time. All normal
skip/pause checks still apply.

### Internal State

| Helper | Type | Purpose |
|--------|------|---------|
| `input_text.irrigation_last_run_status` | text | completed/skipped/aborted/paused/hard_stopped/manually_stopped/running |
| `input_text.irrigation_last_run_details` | text | Human-readable summary |
| `input_text.irrigation_last_run_skipped_zones` | text | Comma-joined slugs of zones that failed mid-run |
| `input_datetime.irrigation_last_run_date` | datetime | When last run/skip happened |
| `input_datetime.irrigation_pause_until` | date | Pause end date (set by pause_days converter) |
| `counter.irrigation_hot_days` | counter | Consecutive days above heat-wave temp |

## Automations

All in `docs/templates/config/automations/irrigation.yaml` (9 automations):

| ID | Alias | Mode | Description |
|---|---|---|---|
| `irrigation_daily_scheduler` | Daily Scheduler | restart | Core scheduler — evaluates pause/skip/group, optional inline controller recovery, runs zones with cycle/soak. Triggered by time-of-day OR `input_boolean.irrigation_run_now`. |
| `irrigation_manual_stop` | Manual Stop | single | Dashboard "Stop All" — closes all valves, clears all per-zone sentinels, records status |
| `irrigation_weather_abort` | Weather Abort | single | Wind/rain during run — closes valves, clears sentinels |
| `irrigation_hard_stop` | Hard Stop | single | End-hour safety cutoff (08:00 default) — closes valves, clears sentinels |
| `irrigation_morning_report` | Morning Report | single | Summary notification when quiet hours end |
| `irrigation_heat_wave_monitor` | Heat Wave Monitor | single | Tracks consecutive hot days, toggles daily mode |
| `irrigation_seasonal_mode` | Seasonal Mode | single | Optional — auto enable/disable tied to a climate-mode input_select |
| `irrigation_pause_converter` | Pause Days Converter | single | UI pause_days → internal pause_until date |
| `irrigation_manual_run` | Manual Zone Run | queued | Dashboard single-zone run with cycle/soak, sets/clears per-zone sentinel, abortable via sentinel |

> **Adding a zone** touches several flat lists. In the automations: add a block
> to `all_zones` (scheduler), add the slug to every valve/sentinel list (manual
> stop, weather abort, hard stop including the hard-stop OR condition), and add
> it to `zone_map` + the manual-run trigger list. Then create the matching
> helpers and add a line to `IRRIGATION_ZONES` in the dashboard. The
> per-zone-loop logic is data-driven, but these flat lists are not — keep them
> in sync.

Optionally pair this with an integration watchdog (continuous reload-retry on
the connectivity sensor) in your `health.yaml`, mirroring the kit's other
integration-monitor patterns. The daily scheduler additionally performs inline
recovery (two reloads over a 5-min wait window, exits early on recovery) when
connectivity is off at start time.

### Scheduler Evaluation Order

1. Is `irrigation_enabled` ON? (condition)
2. If triggered by `irrigation_run_now`: clear the boolean immediately
3. Clear any leftover per-zone sentinels; reset skipped-zones accumulator
4. Is irrigation paused? → record "paused" and stop
5. Any weather skip active? → record "skipped — reason" and stop
6. Is today scheduled for any group (front/back/both)? → if "none", stop
7. (Optional) Is the controller offline?
   - Fire reload, wait up to 2 min for connectivity
   - If still offline, fire second reload, wait up to 3 min
   - If still offline after 5 min total → record "skipped — recovery failed" and stop
   - Otherwise fall through
8. For each enabled zone in today's group:
   - Check zone valve availability; if unavailable, reload + 30s wait
   - If still unavailable: append slug to skipped_zones, continue to next zone
   - Otherwise: set per-zone sentinel, run cycle/soak loop (each iteration gated
     on sentinel), clear sentinel
9. Record completion (includes "partial" count + skipped slugs if any)

### Notifications

Single morning report when quiet hours end, sent to `notify.your_notify_target`.
The original setup notified two phones — add a second `notify.…` action if you
want a second recipient. Interruption level: `time-sensitive`.

## Pause Feature

For pest-control treatment or other temporary suspensions:

- User sets `input_number.irrigation_pause_days` (e.g. 2)
- `irrigation_pause_converter` converts it to `input_datetime.irrigation_pause_until`
  = today + 2 days, then resets `pause_days` to 0
- Scheduler checks `pause_until` date — deterministic, no daily decrement needed
- Auto-resumes when the date passes
- Morning report includes "Paused until {date} ({N} days remaining)"

## Heat Wave Boost

- Evaluated daily at 23:00
- If max temp > 35 °C: increment `counter.irrigation_hot_days`
- If max temp < 32 °C: reset counter to 0
- When counter ≥ 3: turn ON `irrigation_heat_boost` → both groups run daily
- When counter resets: turn OFF boost → return to normal frequency

(Thresholds 35/32 °C are inline in the heat-wave automation; expose them as
`input_number` helpers if you want them dashboard-configurable.)

## Future Upgrades

- Replace forecast-based rain with a ground-truth rain gauge
- Replace forecast wind with a local anemometer
- Per-zone soil-moisture skip logic
- Solar-radiation / ET-based dynamic run times
