/** Icon and label metadata for AC climate entity attributes. */

export const HVAC_META: Record<string, { icon: string; label: string }> = {
  off: { icon: "mdi:power", label: "Off" },
  heat: { icon: "mdi:fire", label: "Heat" },
  cool: { icon: "mdi:snowflake", label: "Cool" },
  dry: { icon: "mdi:water-percent", label: "Dry" },
  fan_only: { icon: "mdi:fan", label: "Fan" },
  auto: { icon: "mdi:thermostat-auto", label: "Auto" },
  heat_cool: { icon: "mdi:thermostat-auto", label: "Auto" },
};

export const FAN_META: Record<string, { icon: string; label: string }> = {
  auto: { icon: "mdi:fan-auto", label: "Auto" },
  quiet: { icon: "mdi:fan-minus", label: "Quiet" },
  silent: { icon: "mdi:fan-minus", label: "Silent" },
  low: { icon: "mdi:fan-speed-1", label: "Low" },
  medium: { icon: "mdi:fan-speed-2", label: "Med" },
  high: { icon: "mdi:fan-speed-3", label: "High" },
  strong: { icon: "mdi:fan-plus", label: "Max" },
};

export const SWING_META: Record<string, { icon: string; label: string }> = {
  off: { icon: "mdi:arrow-collapse-vertical", label: "Off" },
  stopped: { icon: "mdi:arrow-collapse-vertical", label: "Off" },
  vertical: { icon: "mdi:arrow-up-down", label: "Vert" },
  horizontal: { icon: "mdi:arrow-left-right", label: "Horiz" },
  both: { icon: "mdi:arrow-all", label: "Both" },
  rangefull: { icon: "mdi:arrow-up-down", label: "Full" },
};

export function getMeta(map: Record<string, { icon: string; label: string }>, key: string) {
  return map[key.toLowerCase()] ?? map[key] ?? { icon: "mdi:help-circle-outline", label: key };
}
