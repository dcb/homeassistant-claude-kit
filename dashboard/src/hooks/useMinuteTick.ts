import { useState, useEffect } from "react";

/**
 * Returns a timestamp that updates every minute when `active` is true.
 * Used for live elapsed-time displays that need periodic re-rendering.
 */
export function useMinuteTick(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
