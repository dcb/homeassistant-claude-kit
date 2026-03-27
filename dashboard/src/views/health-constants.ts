/** Platforms whose battery sensors aren't home-automation devices */
export const EXCLUDED_BATTERY_PLATFORMS = new Set([
  "mobile_app",    // phones, tablets
  "tesla_fleet",   // car
  "roborock",      // vacuum
  "dreame",        // vacuum
  "ecovacs",       // vacuum
  "valetudo",      // vacuum
]);

// Add entries here during setup — populate with your integration probe entities.
// Example:
// import { PROBE_NETATMO, PROBE_HUE } from "../lib/entities";
// { name: "Netatmo", entity: PROBE_NETATMO, icon: "mdi:weather-partly-cloudy" },
// { name: "Hue", entity: PROBE_HUE, icon: "mdi:lightbulb-group" },
export const MONITORED_INTEGRATIONS: Array<{ name: string; entity: string; icon: string }> = [];

// Add critical sensors here — if these go stale, SystemHealthView highlights them.
// Example:
// import { OUTDOOR_TEMP } from "../lib/entities";
// OUTDOOR_TEMP,
export const STALE_SENSORS: string[] = [];

// Add your health automations here to track their enabled/disabled state.
// Example:
// import { AUTO_INTEGRATION_MONITOR, AUTO_LOW_BATTERY } from "../lib/entities";
// { entity: AUTO_INTEGRATION_MONITOR, label: "Integration Monitor" },
// { entity: AUTO_LOW_BATTERY, label: "Low Battery Alert" },
export const HEALTH_AUTOMATIONS: Array<{ entity: string; label: string }> = [];

export const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface BatteryInfo {
  name: string;
  level: number;
  entityId: string;
}
