/**
 * AC unit configuration — per-unit capabilities for the AcControlPopup.
 * HVAC modes and target_temp_step are read from entity attributes at runtime;
 * these define fan and swing modes which differ between units.
 *
 * Populate during setup with your actual AC entities and supported modes.
 */

export interface AcConfig {
  entity: string;
  label: string;
  sublabel: string;
  manualEntity: string;
  timerEntity: string;
  zoneTargetEntity: string;
  fanModes: string[];
  swingModes: string[];
}

// Add your AC units here. Fan/swing modes vary by manufacturer — check your unit's
// entity attributes in Developer Tools > States for the supported values.
// Example:
// import { LR_AC, LR_AC_MANUAL, LR_AC_TIMER, GROUND_FLOOR_TARGET } from "./entities";
// {
//   entity: LR_AC,
//   label: "Living Room",
//   sublabel: "Your AC Model",
//   manualEntity: LR_AC_MANUAL,
//   timerEntity: LR_AC_TIMER,
//   zoneTargetEntity: GROUND_FLOOR_TARGET,
//   fanModes: ["auto", "low", "medium", "high"],
//   swingModes: ["off", "vertical", "horizontal", "both"],
// },
export const AC_UNITS: AcConfig[] = [];
