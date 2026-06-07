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

export const AC_UNITS: AcConfig[] = [
  {
    entity:           "climate.downstairs",
    label:            "Downstairs",
    sublabel:         "Ecobee",
    manualEntity:     "input_boolean.ac_manual_downstairs",
    timerEntity:      "input_number.ac_timer_downstairs",
    zoneTargetEntity: "sensor.zone_effective_target_downstairs",
    fanModes:         ["on", "off"],
    swingModes:       [],
  },
  {
    entity:           "climate.master_bedroom",
    label:            "Master Bedroom",
    sublabel:         "Ecobee",
    manualEntity:     "input_boolean.ac_manual_master",
    timerEntity:      "input_number.ac_timer_master",
    zoneTargetEntity: "sensor.zone_effective_target_master_bed",
    fanModes:         ["on", "off"],
    swingModes:       [],
  },
  {
    entity:           "climate.family_room",
    label:            "Family Room",
    sublabel:         "Ecobee",
    manualEntity:     "input_boolean.ac_manual_family",
    timerEntity:      "input_number.ac_timer_family",
    zoneTargetEntity: "sensor.zone_effective_target_family_room",
    fanModes:         ["on", "off"],
    swingModes:       [],
  },
];
