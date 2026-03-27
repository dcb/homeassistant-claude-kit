/**
 * @file ZoneChart — Zone temperature history chart (uPlot).
 *
 * @ha-integration HA history WebSocket API (built-in, no extra integration needed)
 * @ha-integration Climate entities (TRVs) for the heating spans overlay
 *
 * The parent component that feeds history data into this chart must pass a stable
 * startTime reference (useMemo or module-level const). Re-creating startTime on
 * every render triggers a new WebSocket subscription on each render cycle, causing
 * an infinite subscription loop. See useHistory.ts for the hook contract.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useMemo } from "react";
import uPlot from "uplot";
import type { HassEntities } from "home-assistant-js-websocket";
import type { HistoryPoint } from "../../hooks/useHistory";
import type { StateSpan } from "../../hooks/useStateHistory";
import { parseNumericState } from "../../lib/format";
import { mergeTimeSeries, downsample } from "../../lib/history-utils";
import {
  type ResolvedTheme,
  type HeatingSpan,
  type ColoredSpan,
  resolveCssColor,
  heatingSpansPlugin,
  acSpansPlugin,
  tooltipPlugin,
  axisDefaults,
  verticalGradient,
} from "../../lib/chart-plugins";
import { UPlotChart } from "../charts/UPlotChart";

// --- Layout constants (shared with HeatingMonitor) ---
const YAXIS_WIDTH = 40;

export interface RadiatorDef {
  entityId: string;
  label: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  sensor: string;
  target: string;
  color: string;
  radiators: RadiatorDef[];
}

export interface ZoneChartProps {
  zone: ZoneDef;
  sensorHistory: HistoryPoint[];
  targetHistory: HistoryPoint[];
  current: number | null;
  currentTarget: number | null;
  dayStart: number;
  dayEnd: number;
  ticks: number[];
  boilerSpans: StateSpan[];
  acSpans?: StateSpan[];
  entities: HassEntities;
  isToday: boolean;
}

function buildZoneChartOpts(
  zoneColor: string,
  spans: HeatingSpan[],
  acColoredSpans: ColoredSpan[],
  dayStartSec: number,
  dayEndSec: number,
  ticksSec: number[],
  theme: ResolvedTheme,
  w: number,
  h: number,
): uPlot.Options {
  const steppedAfter = uPlot.paths.stepped!({ align: 1 });
  const axis = axisDefaults(theme);
  const color = resolveCssColor(zoneColor);

  return {
    width: w,
    height: h,
    padding: [6, 5, 0, 0],
    legend: { show: false },
    cursor: {
      y: false,
      points: {
        size: 6,
        fill: color,
        stroke: "#fff",
        width: 1,
      },
    },
    scales: {
      x: { min: dayStartSec, max: dayEndSec },
    },
    axes: [
      {
        ...axis,
        splits: () => ticksSec,
        values: () =>
          ticksSec.map((t) =>
            new Date(t * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
          ),
        size: 20,
        font: `9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      },
      {
        ...axis,
        values: (_u: uPlot, ticks: number[]) => ticks.map((v) => `${v}°`),
        size: YAXIS_WIDTH,
        font: `9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      },
    ],
    series: [
      {}, // x-axis (timestamps)
      {
        // Temperature
        stroke: color,
        width: 1.5,
        fill: (u: uPlot) => verticalGradient(u, color, 0.25, 0),
        points: { show: false },
      },
      {
        // Target (step-after, dashed)
        stroke: theme.accentWarm,
        width: 1.5,
        dash: [4, 3],
        paths: steppedAfter,
        points: { show: false },
      },
    ],
    plugins: [
      heatingSpansPlugin(spans, `${theme.accentWarm}14`),
      acSpansPlugin(acColoredSpans),
      tooltipPlugin(
        (idx, data, t) => {
          const temp = data[1][idx] as number | null;
          const target = data[2][idx] as number | null;
          const rows = [];
          if (temp != null) {
            rows.push({
              color: color,
              label: "",
              value: `${temp.toFixed(1)}°C`,
            });
          }
          if (target != null) {
            rows.push({
              color: t.accentWarm,
              label: "target",
              value: `${target.toFixed(1)}°C`,
            });
          }
          if (temp != null && target != null) {
            const delta = temp - target;
            const deltaColor =
              delta < -0.5
                ? t.accentCool
                : delta > 0.5
                  ? t.accentWarm
                  : t.accentGreen;
            const text =
              delta < -0.5
                ? `${Math.abs(delta).toFixed(1)}° below`
                : delta > 0.5
                  ? `${delta.toFixed(1)}° above`
                  : "on target";
            rows.push({ color: deltaColor, label: "", value: text });
          }
          return rows;
        },
        theme,
      ),
    ],
  };
}

export function ZoneChart({
  zone,
  sensorHistory,
  targetHistory,
  current,
  currentTarget,
  dayStart,
  dayEnd,
  ticks,
  boilerSpans,
  acSpans,
  entities,
  isToday,
}: ZoneChartProps) {
  const baseChartData = useMemo(
    () =>
      mergeTimeSeries(
        downsample(sensorHistory, 5 * 60_000),
        targetHistory,
      ),
    [sensorHistory, targetHistory],
  );

  // Extend chart to "now" for today's view
  let chartRows = baseChartData;
  if (isToday && baseChartData.length > 0) {
    const last = baseChartData[baseChartData.length - 1];
    const now = Date.now();
    if (now - last.time > 60_000) {
      chartRows = [
        ...baseChartData,
        { time: now, temp: last.temp, target: last.target },
      ];
    }
  }

  const hasData = chartRows.length >= 2;

  // Convert row data to uPlot column arrays (epoch-seconds)
  const uData = useMemo((): uPlot.AlignedData => {
    const times = new Float64Array(chartRows.length);
    const temps: (number | null)[] = new Array(chartRows.length);
    const targets: (number | null)[] = new Array(chartRows.length);
    for (let i = 0; i < chartRows.length; i++) {
      times[i] = chartRows[i].time / 1000;
      temps[i] = chartRows[i].temp;
      targets[i] = chartRows[i].target;
    }
    return [times, temps, targets];
  }, [chartRows]);

  // Clip boiler heating spans to this day, convert to epoch-seconds
  const heatingSpans = useMemo(
    (): HeatingSpan[] =>
      boilerSpans
        .filter((s) => s.state === "heating")
        .map((s) => ({
          start: Math.max(s.start, dayStart) / 1000,
          end: Math.min(s.end, dayEnd) / 1000,
        }))
        .filter((a) => a.start < a.end),
    [boilerSpans, dayStart, dayEnd],
  );

  // AC spans: heat → warm stripes, cool/dry → cool stripes
  const acColoredSpans = useMemo((): ColoredSpan[] => {
    if (!acSpans) return [];
    return acSpans
      .filter((s) => s.state === "heat" || s.state === "cool" || s.state === "dry")
      .map((s) => ({
        start: Math.max(s.start, dayStart) / 1000,
        end: Math.min(s.end, dayEnd) / 1000,
        color: s.state === "heat"
          ? resolveCssColor("var(--color-accent-warm)") + "40"
          : resolveCssColor("var(--color-accent-cool)") + "40",
      }))
      .filter((a) => a.start < a.end);
  }, [acSpans, dayStart, dayEnd]);

  const ticksSec = useMemo(() => ticks.map((t) => t / 1000), [ticks]);
  const dayStartSec = dayStart / 1000;
  const dayEndSec = dayEnd / 1000;

  const buildOpts = useMemo(
    () => (theme: ResolvedTheme, w: number, h: number) =>
      buildZoneChartOpts(zone.color, heatingSpans, acColoredSpans, dayStartSec, dayEndSec, ticksSec, theme, w, h),
    [zone.color, heatingSpans, acColoredSpans, dayStartSec, dayEndSec, ticksSec],
  );

  const delta =
    current !== null && currentTarget !== null ? current - currentTarget : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{zone.name}</span>
        <div className="flex items-center gap-2 text-xs">
          {current !== null && (
            <span className="font-medium tabular-nums">
              {current.toFixed(1)}°
            </span>
          )}
          {currentTarget !== null && (
            <span className="text-text-dim tabular-nums">
              → {currentTarget.toFixed(1)}°
            </span>
          )}
          {delta !== null && (
            <span
              className={`tabular-nums ${
                delta < -0.5
                  ? "text-accent-cool"
                  : delta > 0.5
                    ? "text-accent-warm"
                    : "text-accent-green"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}°
            </span>
          )}
        </div>
      </div>
      <div className="h-28">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-text-dim">
            Loading...
          </div>
        ) : (
          <UPlotChart buildOpts={buildOpts} data={uData} height={112} />
        )}
      </div>
      {/* Radiator snapshot */}
      {zone.radiators.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-[40px] text-[10px] text-text-dim">
          {zone.radiators.map((rad) => {
            const e = entities[rad.entityId];
            if (!e) return null;
            const temp = e.attributes?.current_temperature as number | undefined;
            const calibId = rad.entityId
              .replace("climate.", "number.")
              .concat("_local_temperature_calibration");
            const calibState = entities[calibId]?.state;
            const calib = parseNumericState(calibState);
            const running = e.attributes?.running_state as string | undefined;
            return (
              <span key={rad.entityId} className="flex items-center gap-1">
                <span className="text-text-secondary">{rad.label}</span>
                {temp != null && (
                  <span className="tabular-nums">{temp.toFixed(1)}°</span>
                )}
                {calib != null && (
                  <span className="tabular-nums text-text-dim/60">
                    cal {calib > 0 ? "+" : ""}{calib.toFixed(1)}
                  </span>
                )}
                {running && running !== "idle" && (
                  <span className="text-accent-warm">{running}</span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
