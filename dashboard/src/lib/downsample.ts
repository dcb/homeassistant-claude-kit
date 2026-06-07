/**
 * Largest Triangle Three Buckets (LTTB) downsampling.
 * Preserves visual shape while reducing point count.
 * Null gaps are preserved: contiguous non-null segments are downsampled independently.
 */
export function lttb(
  x: number[],
  y: (number | null)[],
  threshold: number,
): [number[], (number | null)[]] {
  if (x.length <= threshold || threshold < 3) return [x, y];

  // Split into contiguous non-null segments
  const outX: number[] = [];
  const outY: (number | null)[] = [];

  let segStart = -1;
  for (let i = 0; i <= x.length; i++) {
    const isNull = i === x.length || y[i] === null;
    if (!isNull && segStart === -1) {
      segStart = i;
    } else if (isNull && segStart !== -1) {
      // Process segment [segStart, i)
      const segLen = i - segStart;
      // Proportional share of threshold for this segment
      const segThreshold = Math.max(3, Math.round((segLen / x.length) * threshold));
      if (segLen <= segThreshold) {
        for (let j = segStart; j < i; j++) {
          outX.push(x[j]);
          outY.push(y[j]);
        }
      } else {
        const [sx, sy] = lttbSegment(x, y as number[], segStart, i, segThreshold);
        for (let j = 0; j < sx.length; j++) {
          outX.push(sx[j]);
          outY.push(sy[j]);
        }
      }
      // Push the null gap marker if not at end
      if (i < x.length) {
        outX.push(x[i]);
        outY.push(null);
      }
      segStart = -1;
    } else if (isNull && segStart === -1 && i < x.length) {
      outX.push(x[i]);
      outY.push(null);
    }
  }

  return [outX, outY];
}

/** Core LTTB on a contiguous segment (no nulls). */
function lttbSegment(
  x: number[],
  y: number[],
  start: number,
  end: number,
  threshold: number,
): [number[], number[]] {
  const len = end - start;
  if (len <= threshold) {
    return [x.slice(start, end), y.slice(start, end)];
  }

  const outX: number[] = [x[start]];
  const outY: number[] = [y[start]];

  const bucketSize = (len - 2) / (threshold - 2);

  let prevIdx = start;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor(start + 1 + i * bucketSize);
    const rangeEnd = Math.min(Math.floor(start + 1 + (i + 1) * bucketSize), end);

    // Average of next bucket (for triangle area)
    const nextStart = Math.floor(start + 1 + (i + 1) * bucketSize);
    const nextEnd = Math.min(Math.floor(start + 1 + (i + 2) * bucketSize), end);
    let avgX = 0;
    let avgY = 0;
    const avgLen = nextEnd - nextStart;
    if (avgLen > 0) {
      for (let j = nextStart; j < nextEnd; j++) {
        avgX += x[j];
        avgY += y[j];
      }
      avgX /= avgLen;
      avgY /= avgLen;
    } else {
      avgX = x[end - 1];
      avgY = y[end - 1];
    }

    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let bestIdx = rangeStart;
    const px = x[prevIdx];
    const py = y[prevIdx];

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (px - avgX) * (y[j] - py) - (px - x[j]) * (avgY - py),
      );
      if (area > maxArea) {
        maxArea = area;
        bestIdx = j;
      }
    }

    outX.push(x[bestIdx]);
    outY.push(y[bestIdx]);
    prevIdx = bestIdx;
  }

  // Always include last point
  outX.push(x[end - 1]);
  outY.push(y[end - 1]);

  return [outX, outY];
}
