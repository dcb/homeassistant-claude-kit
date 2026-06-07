import { useState, useEffect } from "react";

/**
 * Returns a timestamp that updates on `intervalMs` cadence (default 60s)
 * when `active` is true. Used for live elapsed-time displays that need
 * periodic re-rendering.
 */
export function useMinuteTick(active: boolean, intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
