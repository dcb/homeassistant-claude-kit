/** Parse a HA entity state string to a number, or null if not numeric. */
export function parseNumericState(state: unknown): number | null {
  if (state == null) return null;
  const n = parseFloat(String(state));
  return isFinite(n) ? n : null;
}

/** Convert a power state+unit to watts. Returns null if unparseable. */
export function toWatts(state: unknown, unit?: string): number | null {
  const v = parseNumericState(state);
  if (v == null) return null;
  if (!unit) return v;
  const u = unit.toLowerCase();
  if (u === "kw") return v * 1000;
  if (u === "mw") return v / 1000;
  return v; // assume W
}

/** Format watts into a human-readable string (e.g. "1.2 kW", "340 W"). */
export function formatPower(watts: number): string {
  const abs = Math.abs(watts);
  if (abs >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${Math.round(watts)} W`;
}

/**
 * Format a temperature state string.
 * Accepts Fahrenheit values (> 50) as-is; converts Celsius (≤ 50) to display.
 * Returns null if unparseable.
 */
export function formatTemp(state: unknown): string | null {
  const v = parseNumericState(state);
  if (v == null) return null;
  return String(Math.round(v));
}

/** Format a duration in ms into a human-readable string (e.g. "2h 15m", "45s"). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** Format a Unix timestamp (ms) as "HH:MM". */
export function formatHour(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Format a Date or ISO string as relative time (e.g. "5 minutes ago", "2 hours ago"). */
export function formatRelativeTime(date: Date | string): string {
  if (typeof date === "string") return formatRelativeTime(new Date(date));
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

/** Alias for formatRelativeTime. */
export const formatTimeAgo = formatRelativeTime;
