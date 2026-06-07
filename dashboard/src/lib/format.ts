/**
 * Safely parse a HA entity state as a number.
 * Returns null for "unavailable", "unknown", empty, or non-numeric values.
 */
export function parseNumericState(state: string | undefined): number | null {
  if (!state || state === "unavailable" || state === "unknown") return null;
  const n = parseFloat(state);
  return Number.isFinite(n) ? n : null;
}

/** Format a temperature value, or return "—" if null. */
export function formatTemp(state: string | undefined): string | null {
  const n = parseNumericState(state);
  return n !== null ? n.toFixed(1) : null;
}

/**
 * Format a power value in watts to a human-readable string.
 * Automatically switches between W and kW.
 */
export function formatPower(watts: number): string {
  if (watts < 10 && watts > -10) return "0 W";
  if (Math.abs(watts) >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${Math.round(watts)} W`;
}

/**
 * Convert an entity's power state to watts, respecting its unit_of_measurement.
 * Returns watts regardless of whether the entity reports in W or kW.
 */
export function toWatts(
  state: string | undefined,
  unit: string | undefined,
): number | null {
  const n = parseNumericState(state);
  if (n === null) return null;
  if (unit === "kW") return n * 1000;
  // Default: assume watts (W, w, or missing)
  return n;
}

/** Format a duration in ms to a human-readable string (e.g., "45m", "2h 15m"). */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format a date/timestamp as a human-readable relative time string.
 * Consolidates CameraPopup.formatRelativeTime, SystemHealthView.formatTimeAgo,
 * and RecentEvents.formatEventTime.
 *
 * @param cutoffHours - After this many hours, fall back to an absolute time.
 *   24 = show "Xh ago" up to 24h (default, used by CameraPopup & SystemHealth),
 *   12 = show "Xh ago" up to 12h then HH:MM (used by RecentEvents).
 */
export function formatRelativeTime(
  input: string | Date,
  cutoffHours = 24,
): string {
  const date = input instanceof Date ? input : new Date(input);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0 || isNaN(diffMs)) return "never";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < cutoffHours) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (cutoffHours >= 24) {
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
  }

  // Fall back to short absolute time or date
  if (cutoffHours < 24) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Extract remaining time from a HA timer entity.
 * Returns a human-readable string like "2h 15m" or "30m", or null if not active.
 */
export function formatTimerRemaining(
  timerEntity: { state: string; attributes?: Record<string, unknown> } | undefined,
): string | null {
  if (!timerEntity || timerEntity.state !== "active") return null;
  const finishesAt = timerEntity.attributes?.finishes_at as string | undefined;
  if (!finishesAt) return null;
  const remaining = new Date(finishesAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format a Date as a short relative time string.
 * Uses lowercase for "just now" and "yesterday" (suitable for inline timestamps).
 */
export function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0 || isNaN(diff)) return "never";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Format an epoch-ms timestamp as "HH:MM" for chart tick labels. */
export function formatHour(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Return a Tailwind color class for a battery level.
 *
 * @param level - Battery percentage (0-100).
 * @param variant - "bg" for background classes, "text" for text classes.
 * @param thresholds - [low, mid] boundaries. Default [20, 50].
 */
export function batteryColorClass(
  level: number,
  variant: "bg" | "text",
  thresholds: [number, number] = [20, 50],
): string {
  const [low, mid] = thresholds;
  if (variant === "bg") {
    if (level < low) return "bg-accent-red";
    if (level < mid) return "bg-accent-warm";
    return "bg-accent-green";
  }
  // text variant
  if (level < low) return "text-accent-red";
  if (level < mid) return "text-accent-warm";
  return "text-accent-green";
}
