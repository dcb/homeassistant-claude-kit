export interface HistoryPoint {
  time: number; // ms since epoch
  value: number | null;
}

export interface StateSpan {
  start: number;
  end: number;
  state: string;
}

/** Merge two time-series arrays, interleaving by timestamp. */
export function mergeTimeSeries(a: HistoryPoint[], b: HistoryPoint[]): HistoryPoint[] {
  const result: HistoryPoint[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].time <= b[j].time) result.push(a[i++]);
    else result.push(b[j++]);
  }
  while (i < a.length) result.push(a[i++]);
  while (j < b.length) result.push(b[j++]);
  return result;
}

/** Downsample to at most maxPoints, preserving min/max values within each bucket. */
export function downsample(data: HistoryPoint[], maxPoints: number): HistoryPoint[] {
  if (data.length <= maxPoints) return data;
  const bucketSize = Math.ceil(data.length / maxPoints);
  const result: HistoryPoint[] = [];
  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, i + bucketSize);
    const numeric = bucket.filter((p) => p.value != null);
    if (numeric.length === 0) {
      result.push(bucket[0]);
      continue;
    }
    const min = numeric.reduce((a, b) => (b.value! < a.value! ? b : a));
    const max = numeric.reduce((a, b) => (b.value! > a.value! ? b : a));
    result.push(min.time <= max.time ? min : max);
    if (min !== max) result.push(min.time <= max.time ? max : min);
  }
  return result;
}

/** Sum milliseconds where spans' state matches and they overlap [startTime, endTime]. */
export function sumActiveSpanMs(
  spans: StateSpan[],
  startTime: number,
  endTime: number,
  activeState = "on",
): number {
  let total = 0;
  for (const span of spans) {
    if (span.state !== activeState) continue;
    const overlapStart = Math.max(span.start, startTime);
    const overlapEnd = Math.min(span.end, endTime);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total;
}
