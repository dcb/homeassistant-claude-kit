// --- Pending state management ---

export interface PendingState {
  power?: boolean;       // on/off toggle
  brightness?: number;   // 0-100
  colorTemp?: number;    // kelvin
  rgb?: [number, number, number];
  effect?: string;
}

/** Timeout (ms) to clear pending if HA never confirms. */
export const PENDING_TIMEOUT = 10_000;

// --- Color helpers (exported for use by other components) ---

/** Map color_temp_kelvin to an approximate RGB color for display. */
export function kelvinToRgb(k: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (k - 2000) / 4500));
  return [
    Math.round(255 - t * 60),   // 255 → 195
    Math.round(160 + t * 80),   // 160 → 240
    Math.round(60 + t * 195),   //  60 → 255
  ];
}

/** Get a CSS color string representing a light's current color. Returns undefined if off. */
export function lightColor(
  isOn: boolean,
  rgb: [number, number, number] | undefined,
  kelvin: number | undefined,
): string | undefined {
  if (!isOn) return undefined;
  if (rgb) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  if (kelvin) {
    const [r, g, b] = kelvinToRgb(kelvin);
    return `rgb(${r},${g},${b})`;
  }
  return "rgb(255,180,80)"; // warm fallback for on lights without color info
}
