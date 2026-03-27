import {
  TIMEOUT_MOTION_NORMAL,
  TIMEOUT_MOTION_NORMAL_LONG,
  TIMEOUT_MOTION_NIGHT,
  TIMEOUT_MOTION_NIGHT_SHORT,
  TIMEOUT_MOTION_MOVIE,
  TRANSITION_ON,
  TRANSITION_OFF,
} from "../lib/entities";
import type { NumberConfig, BooleanConfig, SettingConfig } from "../lib/settings-types";
export type { NumberConfig, BooleanConfig, SettingConfig };

// ── Lighting ─────────────────────────────────────────────────────────
//
// Motion timeouts and transitions are generic — every HA motion-light setup needs
// these. Populate the entity IDs in lib/entities.ts during setup.

export const MOTION_TIMEOUTS: NumberConfig[] = [
  { kind: "number", entity: TIMEOUT_MOTION_NORMAL, label: "Normal", unit: "s", min: 30, max: 600, step: 10,
    help: "Time after last motion before lights turn off during the day." },
  { kind: "number", entity: TIMEOUT_MOTION_NORMAL_LONG, label: "Normal Long", unit: "s", min: 60, max: 600, step: 10,
    help: "Extended daytime timeout for rooms where brief absences are common (e.g. dressing room)." },
  { kind: "number", entity: TIMEOUT_MOTION_NIGHT, label: "Night", unit: "s", min: 5, max: 120, step: 5,
    help: "Time after last motion before lights turn off during night mode." },
  { kind: "number", entity: TIMEOUT_MOTION_NIGHT_SHORT, label: "Night Short", unit: "s", min: 5, max: 60, step: 5,
    help: "Very short night timeout for quick-pass areas like stairs and hallways." },
  { kind: "number", entity: TIMEOUT_MOTION_MOVIE, label: "Movie", unit: "s", min: 5, max: 120, step: 5,
    help: "Motion timeout during movie/ambient mode." },
];

export const TRANSITIONS: NumberConfig[] = [
  { kind: "number", entity: TRANSITION_ON, label: "Turn On", unit: "s", min: 0, max: 10, step: 0.5,
    help: "Fade-in duration when lights turn on." },
  { kind: "number", entity: TRANSITION_OFF, label: "Turn Off", unit: "s", min: 0, max: 10, step: 0.5,
    help: "Fade-out duration when lights turn off." },
];

// ── Add your own sections below ───────────────────────────────────────
//
// The setup-customize skill will add entries here as you describe your setup.
// You can also add them manually following the pattern above.
//
// Example — climate settings:
// import { HYSTERESIS_HEAT_ON, ECO_TEMPERATURE } from "../lib/entities";
// export const CLIMATE_SETTINGS: SettingConfig[] = [
//   { kind: "number", entity: HYSTERESIS_HEAT_ON, label: "Heat ON Below Target", unit: "°C", min: 0.1, max: 1.5, step: 0.1,
//     help: "How far below target the room must drop before heating activates." },
//   { kind: "number", entity: ECO_TEMPERATURE, label: "Eco Setback", unit: "°C", min: 10, max: 20, step: 0.5,
//     help: "Temperature during eco/away periods." },
// ];
//
// Example — automation toggles:
// import { WORK_MODE_AUTO } from "../lib/entities";
// export const AUTOMATION_TOGGLES: BooleanConfig[] = [
//   { kind: "boolean", entity: WORK_MODE_AUTO, label: "Auto Work Mode",
//     description: "Activate work mode on presence",
//     help: "Automatically enables work lighting when desk occupancy sensor detects presence." },
// ];
