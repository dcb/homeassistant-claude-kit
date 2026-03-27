/**
 * @file ZoneHistoryPopup — Zone temperature + heating history popup (uPlot).
 *
 * @ha-integration HA history WebSocket API (built-in)
 * @ha-integration Climate entities (TRVs) for heating spans overlay
 *
 * Inherits all ZoneChart constraints. startTime is computed with useMemo to
 * maintain a stable reference across renders — do not inline the date computation
 * in the JSX or it will re-create a new Date on every render, triggering a new
 * WebSocket subscription each time.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useState, useMemo, useRef } from "react";
import uPlot from "uplot";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { useMultiHistory } from "../../hooks/useHistory";
import { useAttributeTimeline, useMultiStateHistory } from "../../hooks/useStateHistory";
import type { StateSpan } from "../../hooks/useStateHistory";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { parseNumericState } from "../../lib/format";
import { DateRangePicker } from "../controls/DateRangePicker";
import { type PeriodKey, PERIODS, startOfToday } from "./zone-history-constants";
import { mergeTimeSeries } from "./zone-history-helpers";
import { lttb } from "../../lib/downsample";
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
import { BottomSheet } from "./BottomSheet";

const LTTB_THRESHOLD_MOBILE = 150;
const LTTB_THRESHOLD_DESKTOP = 300;

function buildZoneHistoryOpts(
  showDate: boolean,
  heatingSpans: HeatingSpan[],
  acColoredSpans: ColoredSpan[],
  theme: ResolvedTheme,
  w: number,
  h: number,
): uPlot.Options {
  const steppedAfter = uPlot.paths.stepped!({ align: 1 });
  const axis = axisDefaults(theme);

  const timeFmt = (sec: number) => {
    const d = new Date(sec * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // For multi-day: show date on a second line only at midnight ticks
  const axisValuesFn = showDate
    ? (_u: uPlot, splits: number[]) =>
        splits.map((sec) => {
          const d = new Date(sec * 1000);
          const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
          const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;
          if (isMidnight) {
            return d.toLocaleDateString([], { day: "numeric", month: "short" });
          }
          return time;
        })
    : (_u: uPlot, splits: number[]) => splits.map(timeFmt);

  return {
    width: w,
    height: h,
    padding: [8, 5, 0, 0],
    legend: { show: false },
    cursor: {
      y: false,
      points: {
        size: 6,
        fill: theme.accent,
        stroke: "#fff",
        width: 1,
      },
    },
    axes: [
      {
        ...axis,
        splits: (u: uPlot) => {
          const xMin = u.scales.x.min!;
          const xMax = u.scales.x.max!;
          const spanDays = (xMax - xMin) / 86400;
          const labelWidth = 35;
          const plotWidth = u.bbox.width / devicePixelRatio;
          const maxTicks = Math.max(2, Math.floor(plotWidth / labelWidth));

          const dMin = new Date(xMin * 1000);
          const start = new Date(dMin.getFullYear(), dMin.getMonth(), dMin.getDate());
          const ticks: number[] = [];

          if (spanDays > 3) {
            // Multi-day: place ticks at midnights only, spaced by nice day intervals
            const rawIntervalDays = spanDays / maxTicks;
            const niceDays = [1, 2, 3, 5, 7, 14, 28];
            const intervalDays = niceDays.find((n) => n >= rawIntervalDays) ?? 28;
            const cursor = new Date(start);
            cursor.setDate(cursor.getDate() + 1); // start at first full midnight
            while (cursor.getTime() / 1000 <= xMax) {
              const sec = cursor.getTime() / 1000;
              if (sec >= xMin) ticks.push(sec);
              cursor.setDate(cursor.getDate() + intervalDays);
            }
          } else {
            // Intra-day or short range: hour-based ticks
            const spanHrs = (xMax - xMin) / 3600;
            const rawIntervalHrs = spanHrs / maxTicks;
            const niceHours = [1, 2, 3, 4, 6, 8, 12, 24];
            const intervalHrs = niceHours.find((n) => n >= rawIntervalHrs) ?? 24;
            const cursor = new Date(start);
            while (cursor.getTime() / 1000 <= xMax) {
              const sec = cursor.getTime() / 1000;
              if (sec >= xMin) ticks.push(sec);
              cursor.setHours(cursor.getHours() + intervalHrs);
            }
          }

          return ticks;
        },
        values: axisValuesFn,
        size: 28,
        font: `11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      },
      {
        ...axis,
        values: (_u: uPlot, ticks: number[]) => ticks.map((v) => `${v}°`),
        size: 32,
        font: `11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
      },
    ],
    series: [
      {}, // timestamps
      {
        // Temperature
        stroke: theme.accent,
        width: 2,
        fill: (u: uPlot) => verticalGradient(u, theme.accent, 0.25, 0),
        points: { show: false },
      },
      {
        // Target (step-after, dashed)
        stroke: theme.accentWarm,
        width: 1.5,
        dash: [4, 4],
        paths: steppedAfter,
        points: { show: false },
      },
    ],
    plugins: [
      heatingSpansPlugin(heatingSpans, `${theme.accentWarm}14`),
      acSpansPlugin(acColoredSpans),
      tooltipPlugin(
        (idx, data, t) => {
          const temp = data[1][idx] as number | null;
          const target = data[2][idx] as number | null;
          const rows = [];
          if (temp != null)
            rows.push({ color: t.accent, value: `${temp.toFixed(1)}°C`, label: "" });
          if (target != null)
            rows.push({ color: t.accentWarm, value: `${target.toFixed(1)}°C`, label: "target" });
          if (temp != null && target != null) {
            const delta = temp - target;
            const deltaColor =
              delta < -0.5 ? t.accentCool
              : delta > 0.5 ? t.accentWarm
              : t.accentGreen;
            const text =
              delta < -0.5 ? `${Math.abs(delta).toFixed(1)}° below`
              : delta > 0.5 ? `${delta.toFixed(1)}° above`
              : "on target";
            rows.push({ color: deltaColor, label: "", value: text });
          }
          return rows;
        },
        theme,
        timeFmt,
      ),
    ],
  };
}

interface ZoneHistoryPopupProps {
  open: boolean;
  onClose: () => void;
  name: string;
  sensorId: string;
  targetId: string;
  boilerEntity: string;
  climateIds?: string[];
}

export function ZoneHistoryPopup({
  open,
  onClose,
  name,
  sensorId,
  targetId,
  boilerEntity,
  climateIds,
}: ZoneHistoryPopupProps) {
  return (
    <BottomSheet open={open} onClose={onClose} className="p-5 md:max-w-lg">
      <HistoryContent name={name} sensorId={sensorId} targetId={targetId} boilerEntity={boilerEntity} climateIds={climateIds} />
    </BottomSheet>
  );
}

function HistoryContent({
  name,
  sensorId,
  targetId,
  boilerEntity,
  climateIds,
}: {
  name: string;
  sensorId: string;
  targetId: string;
  boilerEntity: string;
  climateIds?: string[];
}) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [periodKey, setPeriodKey] = useState<PeriodKey>("today");
  const [customFrom, setCustomFrom] = useState<Date>(() => startOfToday());
  const [customTo, setCustomTo] = useState<Date>(() => startOfToday());
  const widthRef = useRef(400);

  const startTime = useMemo(() => {
    if (periodKey === "custom") {
      const d = new Date(customFrom);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    const period = PERIODS.find((p) => p.key === periodKey)!;
    return period.start().toISOString();
  }, [periodKey, customFrom]);

  const historyMap = useMultiHistory([sensorId, targetId], startTime);
  const sensorHistory = historyMap[sensorId] ?? [];
  const targetHistory = historyMap[targetId] ?? [];

  // Boiler and AC state history
  const boilerSpans = useAttributeTimeline(boilerEntity, "hvac_action", startTime);
  const acIds = useMemo(() => climateIds ?? [], [climateIds]);
  const acStateMap = useMultiStateHistory(acIds, startTime);

  const current = parseNumericState(entities[sensorId]?.state);
  const currentTarget = parseNumericState(entities[targetId]?.state);

  const filteredSensor = useMemo(() => {
    if (periodKey !== "custom") return sensorHistory;
    const end = new Date(customTo);
    end.setHours(23, 59, 59, 999);
    return sensorHistory.filter((p) => p.time <= end.getTime());
  }, [sensorHistory, periodKey, customTo]);

  const filteredTarget = useMemo(() => {
    if (periodKey !== "custom") return targetHistory;
    const end = new Date(customTo);
    end.setHours(23, 59, 59, 999);
    return targetHistory.filter((p) => p.time <= end.getTime());
  }, [targetHistory, periodKey, customTo]);

  const chartRows = useMemo(
    () => mergeTimeSeries(filteredSensor, filteredTarget),
    [filteredSensor, filteredTarget],
  );

  // Filter boiler/AC spans for custom date ranges
  const filteredBoilerSpans = useMemo(() => {
    if (periodKey !== "custom") return boilerSpans;
    const end = new Date(customTo);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    return boilerSpans.filter((s) => s.start <= endMs);
  }, [boilerSpans, periodKey, customTo]);

  const filteredAcSpans = useMemo((): StateSpan[] => {
    const spans: StateSpan[] = [];
    for (const id of acIds) {
      const idSpans = acStateMap[id] ?? [];
      spans.push(
        ...idSpans.filter(
          (s) => s.state === "heat" || s.state === "cool" || s.state === "dry",
        ),
      );
    }
    const sorted = spans.sort((a, b) => a.start - b.start);
    if (periodKey !== "custom") return sorted;
    const end = new Date(customTo);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    return sorted.filter((s) => s.start <= endMs);
  }, [acStateMap, acIds, periodKey, customTo]);

  // Convert to plugin-ready formats (epoch-seconds)
  const heatingSpans = useMemo(
    (): HeatingSpan[] =>
      filteredBoilerSpans
        .filter((s) => s.state === "heating")
        .map((s) => ({ start: s.start / 1000, end: s.end / 1000 })),
    [filteredBoilerSpans],
  );

  const acColoredSpans = useMemo((): ColoredSpan[] => {
    return filteredAcSpans.map((s) => ({
      start: s.start / 1000,
      end: s.end / 1000,
      color:
        s.state === "heat"
          ? resolveCssColor("var(--color-accent-warm)") + "40"
          : resolveCssColor("var(--color-accent-cool)") + "40",
    }));
  }, [filteredAcSpans]);

  // Convert to uPlot columns with LTTB downsampling
  const uData = useMemo((): uPlot.AlignedData => {
    if (chartRows.length < 2) return [new Float64Array(0), [], []];
    const threshold =
      widthRef.current < 640 ? LTTB_THRESHOLD_MOBILE : LTTB_THRESHOLD_DESKTOP;

    // Build raw column arrays
    const rawTimes: number[] = new Array(chartRows.length);
    const rawTemps: (number | null)[] = new Array(chartRows.length);
    const rawTargets: (number | null)[] = new Array(chartRows.length);
    for (let i = 0; i < chartRows.length; i++) {
      rawTimes[i] = chartRows[i].time / 1000;
      rawTemps[i] = chartRows[i].temp;
      rawTargets[i] = chartRows[i].target;
    }

    // LTTB each series independently (preserves real gaps)
    const [dsTimesT, dsTemps] = lttb(rawTimes, rawTemps, threshold);
    const [dsTimesG, dsTargets] = lttb(rawTimes, rawTargets, threshold);

    // Since LTTB may pick different points for each series, merge back into
    // aligned columns using the union of both timestamp sets.
    // For temp: keep a rawTempByTime fallback so target-LTTB-only timestamps
    // don't get spurious nulls (which would break the temperature line).
    const rawTempByTime = new Map<number, number | null>();
    for (let i = 0; i < rawTimes.length; i++) rawTempByTime.set(rawTimes[i], rawTemps[i]);

    const timeSet = new Set<number>();
    for (const t of dsTimesT) timeSet.add(t);
    for (const t of dsTimesG) timeSet.add(t);
    const times = Array.from(timeSet).sort((a, b) => a - b);

    const tempMap = new Map<number, number | null>();
    for (let i = 0; i < dsTimesT.length; i++) tempMap.set(dsTimesT[i], dsTemps[i]);
    const targetMap = new Map<number, number | null>();
    for (let i = 0; i < dsTimesG.length; i++) targetMap.set(dsTimesG[i], dsTargets[i]);

    const aligned = new Float64Array(times.length);
    const temps: (number | null)[] = new Array(times.length);
    const targets: (number | null)[] = new Array(times.length);
    for (let i = 0; i < times.length; i++) {
      aligned[i] = times[i];
      const lttbTemp = tempMap.get(times[i]);
      temps[i] = lttbTemp !== undefined ? lttbTemp : (rawTempByTime.get(times[i]) ?? null);
      targets[i] = targetMap.get(times[i]) ?? null;
    }
    return [aligned, temps, targets];
  }, [chartRows]);

  const showDate = periodKey !== "today";

  const buildOpts = useMemo(
    () => (theme: ResolvedTheme, w: number, h: number) =>
      buildZoneHistoryOpts(showDate, heatingSpans, acColoredSpans, theme, w, h),
    [showDate, heatingSpans, acColoredSpans],
  );

  const handleResize = (w: number) => {
    widthRef.current = w;
  };

  return (
    <div>
      <DialogTitle className="text-base font-semibold">{name}</DialogTitle>
      <DialogDescription className="sr-only">
        Temperature history chart for {name}
      </DialogDescription>
      <div className="mt-1 flex items-baseline gap-3">
        {current !== null && (
          <span className="text-2xl font-semibold tabular-nums">
            {current.toFixed(1)}°C
          </span>
        )}
        {currentTarget !== null && (
          <span className="text-sm text-text-dim">
            Target: {currentTarget.toFixed(1)}°C
          </span>
        )}
      </div>

      {/* Period picker + custom range */}
      <div className="mt-3 flex items-center gap-2">
        <select
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
          className="appearance-none rounded-lg bg-bg-elevated bg-size-[16px] bg-position-[right_6px_center] bg-no-repeat py-1 pl-2.5 pr-6 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 3.5L11.5 6'/%3E%3C/svg%3E")`,
          }}
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>

        {periodKey === "custom" && (
          <DateRangePicker
            from={customFrom}
            to={customTo}
            onChange={({ from, to }) => {
              setCustomFrom(from);
              setCustomTo(to);
            }}
          />
        )}
      </div>

      {/* Chart */}
      <div className="mt-4 h-56">
        {chartRows.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            Loading history...
          </div>
        ) : (
          <UPlotChart
            buildOpts={buildOpts}
            data={uData}
            height={224}
            onResize={handleResize}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          Temp
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-t border-dashed border-accent-warm" />
          Target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-accent-warm/10 ring-1 ring-inset ring-accent-warm/20" />
          Boiler
        </span>
        {acIds.length > 0 && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-sm bg-accent-warm/60" />
              Heat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-sm bg-accent-cool/60" />
              Cool
            </span>
          </>
        )}
      </div>
    </div>
  );
}
