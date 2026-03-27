import type { StateSpan } from "../../hooks/useStateHistory";
import { formatHour } from "../../lib/format";

export interface TimelineStripProps {
  label: string;
  spans: StateSpan[];
  dayStart: number;
  dayEnd: number;
  colorFn: (state: string) => string | null;
  hourlyTicks: number[];
  yAxisWidth: number;
  marginRight: number;
}

export function TimelineStrip({
  label,
  spans,
  dayStart,
  dayEnd,
  colorFn,
  hourlyTicks,
  yAxisWidth,
  marginRight,
}: TimelineStripProps) {
  const totalMs = dayEnd - dayStart;
  if (totalMs <= 0) return null;

  const visible = spans
    .map((s) => ({
      start: Math.max(s.start, dayStart),
      end: Math.min(s.end, dayEnd),
      state: s.state,
    }))
    .filter((s) => s.start < s.end);

  return (
    <div
      className="relative flex items-center"
      style={{ marginLeft: yAxisWidth, marginRight }}
    >
      {/* Label positioned in the left margin */}
      <span className="absolute right-full top-1/2 -translate-y-1/2 pr-1.5 text-[10px] text-text-dim whitespace-nowrap">
        {label}
      </span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/5">
        {/* Hourly tick marks */}
        {hourlyTicks.map((t) => {
          const pct = ((t - dayStart) / totalMs) * 100;
          if (pct <= 0 || pct >= 100) return null;
          return (
            <div
              key={t}
              className="absolute top-0 h-full w-px bg-white/[0.07]"
              style={{ left: `${pct}%` }}
            />
          );
        })}
        {/* State spans */}
        {visible.map((span) => {
          const color = colorFn(span.state);
          if (!color) return null;
          const left = ((span.start - dayStart) / totalMs) * 100;
          const width = ((span.end - span.start) / totalMs) * 100;
          return (
            <div
              key={`${span.start}-${span.end}`}
              className="absolute top-0 h-full"
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.3)}%`,
                backgroundColor: color,
                opacity: 0.7,
              }}
              title={`${span.state}: ${formatHour(span.start)} – ${formatHour(span.end)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Color functions for HVAC state spans ---

export function boilerColor(state: string): string | null {
  if (state === "heating") return "var(--color-accent-warm)";
  return null;
}

export function acColor(state: string): string | null {
  if (state === "heat") return "var(--color-accent-warm)";
  if (state === "cool" || state === "dry") return "var(--color-accent-cool)";
  if (state === "fan_only") return "var(--color-text-dim)";
  return null;
}
