import { useId } from "react";
import type { HistoryPoint } from "../../hooks/useHistory";
import type { StateSpan } from "../../hooks/useStateHistory";

interface SparklineProps {
  data: HistoryPoint[];
  targetData?: HistoryPoint[];
  height?: number;
  color?: string;
  boilerSpans?: StateSpan[];
  acSpans?: StateSpan[];
}

/**
 * Tiny SVG sparkline for embedding in cards.
 * Stretches to fill container width via viewBox.
 * Shows temperature trend with optional target history as a dashed line.
 * Optionally renders boiler/AC activity bands behind the chart.
 */
export function Sparkline({
  data,
  targetData,
  height = 28,
  color = "var(--color-accent)",
  boilerSpans,
  acSpans,
}: SparklineProps) {
  const gradientId = useId();
  const warmPatternId = useId();
  const coolPatternId = useId();

  if (data.length < 2) return null;

  // Internal coordinate system (viewBox)
  const vw = 200;
  const vh = height;

  const allValues = [
    ...data.map((d) => d.value),
    ...(targetData ?? []).map((d) => d.value),
  ];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const padY = 3;
  const innerH = vh - padY * 2;

  const tMin = data[0].time;
  const tMax = data[data.length - 1].time;
  const tRange = tMax - tMin || 1;

  const toX = (t: number) => ((t - tMin) / tRange) * vw;
  const toY = (v: number) => padY + innerH - ((v - min) / range) * innerH;

  const pathPoints = data.map((d) => `${toX(d.time)},${toY(d.value)}`);
  const linePath = `M${pathPoints.join("L")}`;
  const fillPath = `${linePath}L${vw},${vh}L0,${vh}Z`;

  // Build target step-line
  let targetPath: string | null = null;
  if (targetData && targetData.length >= 1) {
    const segments: string[] = [];
    for (let i = 0; i < targetData.length; i++) {
      const x = toX(Math.max(targetData[i].time, tMin));
      const y = toY(targetData[i].value);
      if (i === 0) {
        segments.push(`M0,${y}`);
        segments.push(`L${x},${y}`);
      } else {
        segments.push(`L${x},${toY(targetData[i - 1].value)}`);
        segments.push(`L${x},${y}`);
      }
    }
    const lastY = toY(targetData[targetData.length - 1].value);
    segments.push(`L${vw},${lastY}`);
    targetPath = segments.join("");
  }

  // Map state spans to SVG rects clipped to the visible data range
  const mapSpanRects = (spans: StateSpan[]) =>
    spans
      .filter((s) => s.end > tMin && s.start < tMax)
      .map((s) => ({
        x: toX(Math.max(s.start, tMin)),
        width: toX(Math.min(s.end, tMax)) - toX(Math.max(s.start, tMin)),
        state: s.state,
      }))
      .filter((r) => r.width > 0);

  const boilerRects = boilerSpans ? mapSpanRects(boilerSpans) : [];
  const acRects = acSpans ? mapSpanRects(acSpans) : [];

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      className="block w-full overflow-hidden"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        {/* Diagonal stripe patterns for AC bands */}
        <pattern
          id={warmPatternId}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0" y1="0" x2="0" y2="4"
            stroke="var(--color-accent-warm)"
            strokeWidth="1.5"
            opacity="0.35"
          />
        </pattern>
        <pattern
          id={coolPatternId}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0" y1="0" x2="0" y2="4"
            stroke="var(--color-accent-cool)"
            strokeWidth="1.5"
            opacity="0.35"
          />
        </pattern>
      </defs>
      {/* Boiler heating bands (solid warm fill) */}
      {boilerRects.map((r, i) => (
        <rect
          key={`b${i}`}
          x={r.x}
          y={0}
          width={r.width}
          height={vh}
          fill="var(--color-accent-warm)"
          opacity={0.12}
        />
      ))}
      {/* AC activity bands (diagonal stripes) */}
      {acRects.map((r, i) => (
        <rect
          key={`a${i}`}
          x={r.x}
          y={0}
          width={r.width}
          height={vh}
          fill={`url(#${r.state === "heat" ? warmPatternId : coolPatternId})`}
        />
      ))}
      <path d={fillPath} fill={`url(#${gradientId})`} />
      {targetPath && (
        <path
          d={targetPath}
          fill="none"
          stroke="var(--color-accent-warm)"
          strokeWidth={0.75}
          strokeDasharray="3,3"
          opacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
