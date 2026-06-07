/**
 * AC unit configuration — per-unit capabilities for the control popup.
 * HVAC modes and target_temp_step are read from entity attributes at runtime;
 * these define fan and swing modes which differ between units.
 *
 * Add your AC units here after setup. Example:
 * {
 *   entity: "climate.living_room_ac",
 *   label: "Living Room",
 *   sublabel: "Your AC Model",
 *   manualEntity: "input_boolean.living_room_ac_manual_mode",
 *   timerEntity: "timer.living_room_ac_manual_mode",
 *   zoneTargetEntity: "sensor.living_room_effective_target",
 *   fanModes: ["auto", "low", "medium", "high"],
 *   swingModes: ["off", "vertical", "horizontal", "both"],
 * }
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

export const AC_UNITS: AcConfig[] = [];
