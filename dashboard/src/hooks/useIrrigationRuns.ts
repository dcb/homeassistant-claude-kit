import { useMemo, useState } from "react";
import { useMultiStateHistory } from "./useHistory";
import { IRRIGATION_ZONES, type IrrigationZoneConfig } from "../lib/entities";

export interface IrrigationRun {
  slug: string;
  name: string;
  group: "front" | "back";
  startedAt: number; // epoch ms
  durationMs: number;
}

export interface IrrigationRunsResult {
  /** Last completed run per zone slug. */
  lastRunByZone: Record<string, IrrigationRun | null>;
  /** All completed runs across zones, newest first. */
  allRuns: IrrigationRun[];
}

/**
 * Subscribes to binary_sensor.{slug}_watering history for every irrigation
 * zone and pairs each on→off transition into a completed run. The current
 * (in-progress) run is not included — it's still on, no off yet.
 */
export function useIrrigationRuns(daysBack = 30): IrrigationRunsResult {
  const [startTime] = useState(() => new Date(Date.now() - daysBack * 86400000).toISOString());
  const entityIds = useMemo(() => IRRIGATION_ZONES.map((z) => z.watering), []);
  const history = useMultiStateHistory(entityIds, startTime);

  return useMemo(() => {
    const zoneByWatering = new Map<string, IrrigationZoneConfig>();
    for (const z of IRRIGATION_ZONES) zoneByWatering.set(z.watering, z);

    const lastRunByZone: Record<string, IrrigationRun | null> = {};
    const allRuns: IrrigationRun[] = [];

    for (const z of IRRIGATION_ZONES) lastRunByZone[z.slug] = null;

    for (const [entityId, points] of Object.entries(history)) {
      const zone = zoneByWatering.get(entityId);
      if (!zone || points.length === 0) continue;

      // Pair on→off. Skip an "on" with no matching "off" (current run).
      let openStart: number | null = null;
      for (const p of points) {
        if (p.state === "on") {
          if (openStart === null) openStart = p.time;
        } else if (p.state === "off") {
          if (openStart !== null) {
            const run: IrrigationRun = {
              slug: zone.slug,
              name: zone.name,
              group: zone.defaultGroup,
              startedAt: openStart,
              durationMs: p.time - openStart,
            };
            // Filter blips (<10s — probably valve glitches, not real runs)
            if (run.durationMs >= 10_000) {
              allRuns.push(run);
            }
            openStart = null;
          }
        }
      }
    }

    allRuns.sort((a, b) => b.startedAt - a.startedAt);

    // Most recent per zone
    for (const run of allRuns) {
      if (lastRunByZone[run.slug] === null) {
        lastRunByZone[run.slug] = run;
      }
    }

    return { lastRunByZone, allRuns };
  }, [history]);
}
