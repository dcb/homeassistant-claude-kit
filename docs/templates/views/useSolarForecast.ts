import { useEffect, useState } from "react";
import { useHass } from "@hakit/core";
import type { HistoryPoint } from "./useHistory";
import { SOLAR_FORECAST_NOW } from "../lib/entities";

/**
 * Fetch solar production forecast for a given day.
 * - Today: uses `energy/solar_forecast` websocket (live forecast from Forecast.Solar)
 * - Past days: uses `recorder/statistics_during_period` for the forecast power sensor
 *
 * Returns points in watts (Wh per hour ~ average W for that hour).
 * `dateStr` must be YYYY-MM-DD format.
 */
export function useSolarForecast(dateStr: string): HistoryPoint[] {
  const connection = useHass((s) => s.connection);
  const [points, setPoints] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;

    const [y, m, d] = dateStr.split("-").map(Number);
    const now = new Date();
    const isToday =
      y === now.getFullYear() && m - 1 === now.getMonth() && d === now.getDate();

    if (isToday) {
      // Live forecast from Forecast.Solar integration
      connection
        .sendMessagePromise<
          Record<string, { wh_hours?: Record<string, number> }>
        >({ type: "energy/solar_forecast" })
        .then((result) => {
          if (cancelled) return;
          const pts: HistoryPoint[] = [];
          for (const entry of Object.values(result)) {
            const whHours = entry?.wh_hours;
            if (!whHours) continue;
            for (const [iso, wh] of Object.entries(whHours)) {
              const t = new Date(iso);
              if (
                t.getFullYear() === y &&
                t.getMonth() === m - 1 &&
                t.getDate() === d
              ) {
                pts.push({ time: t.getTime(), value: wh });
              }
            }
          }
          pts.sort((a, b) => a.time - b.time);
          setPoints(pts);
        })
        .catch(() => setPoints([]));
    } else {
      // Historical forecast from recorder statistics
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

      connection
        .sendMessagePromise<
          Record<string, Array<{ start: number; mean: number | null }>>
        >({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          statistic_ids: [SOLAR_FORECAST_NOW],
          period: "hour",
          types: ["mean"],
          units: { power: "W" },
        })
        .then((result) => {
          if (cancelled) return;
          const stats = result?.[SOLAR_FORECAST_NOW] ?? [];
          const pts: HistoryPoint[] = stats
            .filter((s) => s.mean != null && s.mean > 0)
            .map((s) => ({
              // HA returns epoch seconds for statistics
              time: s.start > 1e12 ? s.start : s.start * 1000,
              value: s.mean!,
            }));
          setPoints(pts);
        })
        .catch(() => setPoints([]));
    }

    return () => {
      cancelled = true;
    };
  }, [connection, dateStr]);

  return points;
}
