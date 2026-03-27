import { useMemo, useState } from "react";
import uPlot from "uplot";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { useMultiHistory, useStateHistory } from "../../hooks/useHistory";
import type { HistoryPoint } from "../../hooks/useHistory";
import { useSolarForecast } from "../../hooks/useSolarForecast";
import { formatPower, parseNumericState } from "../../lib/format";
import type { SolarChartConfig } from "../../lib/entities";
import { toDateStr } from "../../lib/date-utils";
import { downsample } from "../../lib/history-utils";
import { mergeChartData, computeTotals } from "../../lib/solar-chart-helpers";
import {
  type ResolvedTheme,
  chartGesturesPlugin,
  tooltipPlugin,
  axisDefaults,
  verticalGradient,
} from "../../lib/chart-plugins";
import { UPlotChart } from "./UPlotChart";
import { SolarChartLegend } from "./SolarChartLegend";
import { DateNavigator } from "../controls/DateNavigator";
import type { ChartRow } from "../../lib/solar-chart-helpers";

/** Convert merged ChartRow[] to uPlot column arrays (epoch-seconds). */
function toColumns(rows: ChartRow[]): uPlot.AlignedData {
  const len = rows.length;
  const times = new Float64Array(len);
  const solar: (number | null)[] = new Array(len);
  const house: (number | null)[] = new Array(len);
  const charger: (number | null)[] = new Array(len);
  const chargerTop: (number | null)[] = new Array(len);
  const forecast: (number | null)[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const r = rows[i];
    times[i] = r.time / 1000;
    solar[i] = r.solar;
    house[i] = r.house;
    charger[i] = r.charger;
    chargerTop[i] = r.chargerTop;
    forecast[i] = r.forecast;
  }
  return [times, solar, house, charger, chargerTop, forecast];
}

function buildSolarChartOpts(
  ticksSec: number[],
  dayRange: [number, number],
  theme: ResolvedTheme,
  w: number,
  h: number,
): uPlot.Options {
  const axis = axisDefaults(theme);

  // Shared state: gesture plugin sets pendingZoom before calling setScale,
  // so the range function can pass zoom values through instead of snapping
  // back to dayRange. Without this, uPlot's internal setScales() always
  // calls range() which would override every zoom attempt.
  let pendingZoom: [number, number] | null = null;
  const beforeZoom = (min: number, max: number) => {
    pendingZoom = [min, max];
  };

  return {
    width: w,
    height: h,
    padding: [8, 5, 0, 0],
    cursor: {
      y: false,
      // Disable built-in zoom application — we handle it via setSelect hook
      // and gesture plugin. drag.x enables the visual selection rectangle.
      drag: { setScale: false, x: true, y: false },
      points: { show: false },
    },
    select: {
      show: true,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    },
    legend: { show: false },
    scales: {
      x: {
        range: (): uPlot.Range.MinMax => {
          if (pendingZoom) {
            const r = pendingZoom;
            pendingZoom = null;
            return r;
          }
          return dayRange;
        },
      },
      y: { min: 0 },
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
        size: 22,
      },
      {
        ...axis,
        values: (_u: uPlot, ticks: number[]) => ticks.map((v) => formatPower(v)),
        size: 45,
      },
    ],
    series: [
      {}, // timestamps
      {
        // Solar (index 1) — standalone line, no fill
        label: "Solar",
        stroke: theme.accentWarm,
        width: 2,
        points: { show: false },
      },
      {
        // House (index 2) — stacked base
        label: "House",
        stroke: theme.accent,
        width: 1.5,
        fill: (u: uPlot) => verticalGradient(u, theme.accent, 0.45, 0.05),
        points: { show: false },
      },
      {
        // Charger (index 3) — stacked on house; fill via band, not series
        label: "Charger",
        stroke: "transparent",
        width: 0,
        points: { show: false },
      },
      {
        // ChargerTop (index 4) — edge line
        label: "ChargerTop",
        stroke: theme.accentGreen,
        width: 1.5,
        points: { show: false },
        show: true,
      },
      {
        // Forecast (index 5) — dashed line
        label: "Forecast",
        stroke: `${theme.accentWarm}80`,
        width: 1.5,
        dash: [6, 4],
        points: { show: false },
      },
    ],
    bands: [
      {
        series: [3, 2], // fill between charger (top) and house (bottom)
        fill: (u: uPlot) => verticalGradient(u, theme.accentGreen, 0.4, 0.1),
      },
    ],
    hooks: {
      // Handle drag-to-zoom: uPlot shows the selection rectangle (drag.x=true)
      // but doesn't apply zoom (drag.setScale=false). We apply it here.
      setSelect: [
        (u: uPlot) => {
          const { left, width } = u.select;
          if (width > 1) {
            const min = u.posToVal(left, "x");
            const max = u.posToVal(left + width, "x");
            beforeZoom(min, max);
            u.setScale("x", { min, max });
            u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
          }
        },
      ],
    },
    plugins: [
      chartGesturesPlugin(dayRange, beforeZoom),
      // Draw vertical green lines at charger start/stop boundaries
      {
        hooks: {
          draw: (u: uPlot) => {
            const ctData = u.data[4] as (number | null)[];
            const hData = u.data[2] as (number | null)[];
            if (!ctData || !hData) return;

            const { ctx } = u;
            const { left, top, width, height } = u.bbox;
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, width, height);
            ctx.clip();
            ctx.strokeStyle = theme.accentGreen;
            ctx.lineWidth = 1.5 * devicePixelRatio;
            ctx.beginPath();

            for (let i = 0; i < ctData.length; i++) {
              const ct = ctData[i];
              const h = hData[i];
              if (ct == null || h == null) continue;
              const prevNull = i === 0 || ctData[i - 1] == null;
              const nextNull = i === ctData.length - 1 || ctData[i + 1] == null;
              if (prevNull || nextNull) {
                const x = u.valToPos(u.data[0][i] as number, "x", true);
                const yTop = u.valToPos(ct, "y", true);
                const yBot = u.valToPos(h, "y", true);
                ctx.moveTo(x, yTop);
                ctx.lineTo(x, yBot);
              }
            }

            ctx.stroke();
            ctx.restore();
          },
        },
      },
      tooltipPlugin(
        (idx, data, t) => {
          const rows = [];
          const s = data[1][idx] as number | null;
          const fc = data[5][idx] as number | null;
          // For house/charger, read pre-stack values would be wrong —
          // read from original row data is not available here. Instead
          // we compute: house = stacked[2], charger = stacked[3] - stacked[2]
          const stackedHouse = data[2][idx] as number | null;
          const stackedCharger = data[3][idx] as number | null;
          const house =
            stackedHouse != null ? stackedHouse : null;
          const charger =
            stackedCharger != null && stackedHouse != null
              ? stackedCharger - stackedHouse
              : null;

          if (s != null) rows.push({ color: t.accentWarm, value: formatPower(s), label: "solar" });
          if (fc != null) rows.push({ color: `${t.accentWarm}80`, value: formatPower(fc), label: "forecast" });
          if (house != null) rows.push({ color: t.accent, value: formatPower(house), label: "house" });
          if (charger != null && charger > 0) {
            rows.push({ color: t.accentGreen, value: formatPower(charger), label: "charger" });
          }
          if (house != null && charger != null && charger > 0) {
            rows.push({ color: t.textDim, value: formatPower(house + charger), label: "total load" });
          }
          return rows;
        },
        theme,
      ),
    ],
  };
}

interface SolarProductionChartProps {
  config: SolarChartConfig;
}

export function SolarProductionChart({ config }: SolarProductionChartProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()));

  const { startTime, endTime, isToday } = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    const now = new Date();
    const today =
      y === now.getFullYear() && m - 1 === now.getMonth() && d === now.getDate();
    return {
      startTime: start.toISOString(),
      endTime: today ? undefined : end.toISOString(),
      isToday: today,
    };
  }, [dateStr]);

  const historyMap = useMultiHistory(
    [config.solarPower, config.loadPower, config.gridPower, config.chargerPowerImport, config.chargerPowerOffered],
    startTime,
    endTime,
  );
  const connectorHistory = useStateHistory(config.chargerStatus, startTime, endTime);
  const solarHistory = historyMap[config.solarPower] ?? [];
  const loadHistory = historyMap[config.loadPower] ?? [];
  const gridHistory = historyMap[config.gridPower] ?? [];
  const chargerImportHistory = historyMap[config.chargerPowerImport] ?? [];
  const chargerOfferedHistory = historyMap[config.chargerPowerOffered] ?? [];
  const forecastHistory = useSolarForecast(dateStr);

  const solarUnit = entities[config.solarPower]?.attributes?.unit_of_measurement as string | undefined;
  const chargerImportUnit = entities[config.chargerPowerImport]?.attributes?.unit_of_measurement as string | undefined;
  const chargerOfferedUnit = entities[config.chargerPowerOffered]?.attributes?.unit_of_measurement as string | undefined;
  const toW = solarUnit === "kW" ? 1000 : 1;
  const importToW = chargerImportUnit === "kW" ? 1000 : 1;
  const offeredToW = chargerOfferedUnit === "kW" ? 1000 : 1;

  // When import meter is broken (all 0s), use offered power but ONLY during
  // periods where connector status was "Charging". Cross-referencing with
  // connector history prevents showing false charging during idle/disconnected periods.
  const chargerHistory = useMemo(() => {
    const hasRealImport = chargerImportHistory.some((p) => p.value * importToW > 50);
    if (hasRealImport || chargerOfferedHistory.length === 0 || connectorHistory.length === 0) {
      return chargerImportHistory;
    }

    // Build "Charging" time ranges from connector status history
    const chargingRanges: { start: number; end: number }[] = [];
    for (let i = 0; i < connectorHistory.length; i++) {
      if (connectorHistory[i].state === "Charging") {
        const start = connectorHistory[i].time;
        // End when next state is not Charging, or now if it's the last entry
        let end = Date.now();
        for (let j = i + 1; j < connectorHistory.length; j++) {
          if (connectorHistory[j].state !== "Charging") {
            end = connectorHistory[j].time;
            break;
          }
        }
        chargingRanges.push({ start, end });
      }
    }
    if (chargingRanges.length === 0) return chargerImportHistory;

    // Find the last offered value at or before a given time
    const sortedOffered = [...chargerOfferedHistory].sort((a, b) => a.time - b.time);
    const getOfferedAt = (t: number): number => {
      let best = -1;
      let lo = 0, hi = sortedOffered.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sortedOffered[mid].time <= t) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return best >= 0 ? sortedOffered[best].value * offeredToW / importToW : 0;
    };

    // Generate charger data: use offered values during charging ranges,
    // with 5-min resolution points
    const INTERVAL = 5 * 60_000;
    const result: HistoryPoint[] = [];
    for (const range of chargingRanges) {
      for (let t = range.start; t <= range.end; t += INTERVAL) {
        const offered = getOfferedAt(t);
        if (offered > 0) result.push({ time: t, value: offered });
      }
    }
    return result.length > 0 ? result : chargerImportHistory;
  }, [chargerImportHistory, chargerOfferedHistory, connectorHistory, importToW, offeredToW]);
  const chargerToW = importToW;

  const chartData = useMemo(
    () =>
      mergeChartData(
        downsample(solarHistory, 5 * 60_000),
        downsample(loadHistory, 5 * 60_000),
        downsample(chargerHistory, 5 * 60_000),
        forecastHistory,
        toW,
        chargerToW,
      ),
    [solarHistory, loadHistory, chargerHistory, forecastHistory, toW, chargerToW],
  );

  const gridPrice = parseNumericState(entities[config.electricityPriceGrid]?.state);
  const exportPrice = parseNumericState(entities[config.electricityPriceExport]?.state);

  const totals = useMemo(
    () =>
      computeTotals(
        solarHistory, loadHistory, gridHistory, chargerHistory,
        toW, chargerToW, gridPrice, exportPrice,
      ),
    [solarHistory, loadHistory, gridHistory, chargerHistory, toW, chargerToW, gridPrice, exportPrice],
  );

  const ticksSec = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Array.from({ length: 9 }, (_, i) =>
      new Date(y, m - 1, d, i * 3).getTime() / 1000,
    );
  }, [dateStr]);

  const hasData = chartData.length >= 2;
  const hasChargerData = totals.chargerSolar > 0.01 || totals.chargerGrid > 0.01;

  // Zoom state for legend sync
  const [isZoomed, setIsZoomed] = useState(false);

  // Convert to uPlot columns with stacking
  const uData = useMemo((): uPlot.AlignedData => {
    if (!hasData) return [new Float64Array(0), [], [], [], [], []];
    const cols = toColumns(chartData);
    // Stack charger on house — preserve null so the band only fills during charging
    const houseCol = cols[2] as (number | null)[];
    const chargerCol = cols[3] as (number | null)[];
    for (let i = 0; i < houseCol.length; i++) {
      const c = chargerCol[i];
      const h = houseCol[i];
      chargerCol[i] = c != null && h != null ? c + h : null;
    }
    return cols;
  }, [chartData, hasData]);

  const dayRange = useMemo((): [number, number] => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return [
      new Date(y, m - 1, d, 0, 0, 0).getTime() / 1000,
      new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000,
    ];
  }, [dateStr]);

  const buildOpts = useMemo(
    () => (theme: ResolvedTheme, w: number, h: number) =>
      buildSolarChartOpts(ticksSec, dayRange, theme, w, h),
    [ticksSec, dayRange],
  );

  const handleScaleChange = (xMin: number, xMax: number) => {
    const fullMin = uData[0][0];
    const fullMax = uData[0][uData[0].length - 1];
    setIsZoomed(xMin > fullMin + 1 || xMax < fullMax - 1);
  };

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">
          Energy
          {isZoomed && (
            <button
              onClick={() => setIsZoomed(false)}
              className="ml-2 text-[10px] font-normal text-accent hover:text-text-primary"
            >
              Reset zoom
            </button>
          )}
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-xs text-text-dim">
          {totals.produced > 0 && (
            <span>
              <span className="text-accent-warm">{totals.produced.toFixed(1)}</span> kWh
            </span>
          )}
          {totals.consumed > 0 && (
            <span>
              <span className="text-text-primary">{totals.consumed.toFixed(1)}</span> kWh used
            </span>
          )}
          {totals.peakSolar > 0 && (
            <span>
              peak <span className="text-accent-warm">{formatPower(totals.peakSolar)}</span>
            </span>
          )}
          {totals.netCost !== null && totals.netCost !== 0 && (
            <span>
              <span className={totals.netCost < 0 ? "text-green-400" : "text-red-400"}>
                {totals.netCost < 0 ? "+" : "\u2212"}{Math.abs(totals.netCost).toFixed(2)}
              </span>{" "}
              RON
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-40">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            {isToday ? "Loading..." : "No data"}
          </div>
        ) : (
          <UPlotChart
            buildOpts={buildOpts}
            data={uData}
            height={160}
            onScaleChange={handleScaleChange}
          />
        )}
      </div>

      {/* Legend + charger breakdown */}
      <SolarChartLegend
        hasForecast={forecastHistory.length > 0}
        hasChargerData={hasChargerData}
        gridPrice={gridPrice}
        totals={totals}
      />

      {/* Day navigation */}
      <div className="mt-3 flex justify-center">
        <DateNavigator
          dateStr={dateStr}
          onDateChange={(d) => {
            setDateStr(d);
            setIsZoomed(false);
          }}
        />
      </div>
    </div>
  );
}
