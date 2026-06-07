import type { HistoryPoint } from "../hooks/useHistory";
import type { StateSpan } from "../hooks/useStateHistory";

/** A unified row for temperature + target time-series charts. */
export interface ChartRow {
  time: number;
  temp: number | null;
  target: number | null;
}

/**
 * Merges sensor and target history into a unified time-series.
 * Target values are step-interpolated (carry forward last known value).
 */
export function mergeTimeSeries(
  sensor: HistoryPoint[],
  target: HistoryPoint[],
): ChartRow[] {
  if (sensor.length === 0) return [];

  const timeSet = new Set<number>();
  for (const p of sensor) timeSet.add(p.time);
  for (const p of target) timeSet.add(p.time);
  const times = Array.from(timeSet).sort((a, b) => a - b);

  const sensorMap = new Map(sensor.map((p) => [p.time, p.value]));
  const targetSorted = [...target].sort((a, b) => a.time - b.time);

  // Forward-fill gap threshold — beyond this, show a real data gap.
  const GAP_MS = 15 * 60_000;

  let targetIdx = 0;
  let lastTarget: number | null =
    targetSorted.length > 0 ? targetSorted[0].value : null;
  let lastSensor: number | null = null;
  let lastSensorTime = 0;

  const rows: ChartRow[] = [];
  for (const t of times) {
    while (targetIdx < targetSorted.length && targetSorted[targetIdx].time <= t) {
      lastTarget = targetSorted[targetIdx].value;
      targetIdx++;
    }
    const exact = sensorMap.get(t);
    if (exact !== undefined) {
      lastSensor = exact;
      lastSensorTime = t;
    }
    const temp = exact !== undefined
      ? exact
      : (lastSensor !== null && t - lastSensorTime <= GAP_MS ? lastSensor : null);
    rows.push({ time: t, temp, target: lastTarget });
  }
  return rows;
}

/** Average points into fixed-width time buckets for smoother charts. */
export function downsample(points: HistoryPoint[], bucketMs: number): HistoryPoint[] {
  if (points.length <= 1) return points;
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    const key = Math.floor(p.time / bucketMs) * bucketMs;
    const b = buckets.get(key);
    if (b) {
      b.sum += p.value;
      b.count++;
    } else {
      buckets.set(key, { sum: p.value, count: 1 });
    }
  }
  return Array.from(buckets, ([time, { sum, count }]) => ({
    time,
    value: sum / count,
  })).sort((a, b) => a.time - b.time);
}

/**
 * Sum active time within a span range, clipped to [start, end].
 *
 * The `isActive` predicate determines which spans count as "active".
 * Supports both a simple predicate and the colorFn pattern (non-null = active).
 */
export function sumActiveSpanMs(
  spans: StateSpan[],
  start: number,
  end: number,
  isActive: (state: string) => boolean,
): number {
  let ms = 0;
  for (const s of spans) {
    if (!isActive(s.state)) continue;
    const a = Math.max(s.start, start);
    const b = Math.min(s.end, end);
    if (a < b) ms += b - a;
  }
  return ms;
}
