/**
 * @file HeatingMonitor — Multi-zone heating overview with daily runtime summary.
 *
 * @ha-integration Climate entities (TRVs) + Adaptive Lighting (optional, for sleep mode)
 * @ha-helpers    input_select.climate_mode (values: Comfort, Eco, Away, Off)
 * @ha-helpers    input_number.hysteresis_heat_on, input_number.hysteresis_heat_off
 * @ha-automation config/automations/climate.yaml — zone TRV control and schedule
 *
 * Zone definitions passed as props must use entity IDs that match the keys in
 * ROOM_ZONE_MAP (lib/entities.ts). The ZoneDef.id must match a RoomConfig.id in
 * lib/areas.ts for room-popup climate sections to find the correct zone data.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useMemo, useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { useMultiHistory } from "../../hooks/useHistory";
import {
  useMultiStateHistory,
  useAttributeTimeline,
} from "../../hooks/useStateHistory";
import { parseNumericState } from "../../lib/format";
import { toDateStr, startOfDay } from "../../lib/date-utils";
import { sumActiveSpanMs } from "../../lib/history-utils";
import { formatHour } from "../../lib/format";
import { DateNavigator } from "../controls/DateNavigator";
import { TimelineStrip, boilerColor, acColor } from "./TimelineStrip";
import { RuntimeSummary } from "./RuntimeSummary";
import { ZoneChart, type ZoneDef } from "./ZoneChart";

// --- Layout constants (keep strips & charts aligned) ---
const YAXIS_WIDTH = 40;
const CHART_MARGIN_RIGHT = 5;

export interface AcSystem {
  entityId: string;
  label: string;
  /** Zone ID to overlay AC spans on a zone's temperature chart */
  zoneId?: string;
}

interface HeatingMonitorProps {
  boilerEntity: string;
  zones: ZoneDef[];
  acSystems: AcSystem[];
}

// --- Helpers ---

function endOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// --- Main component ---

export function HeatingMonitor({ boilerEntity, zones, acSystems }: HeatingMonitorProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()));

  const { startTime, endTime, isToday, dayStart, dayEnd } = useMemo(() => {
    const start = startOfDay(dateStr);
    const end = endOfDay(dateStr);
    const now = new Date();
    const today = toDateStr(now) === dateStr;
    return {
      startTime: start.toISOString(),
      endTime: today ? undefined : end.toISOString(),
      isToday: today,
      dayStart: start.getTime(),
      dayEnd: end.getTime(),
    };
  }, [dateStr]);

  // Collect all entity IDs for numeric history
  const numericIds = useMemo(
    () => zones.flatMap((z) => [z.sensor, z.target]),
    [zones],
  );
  const historyMap = useMultiHistory(numericIds, startTime, endTime);

  // Boiler: use hvac_action attribute for actual firing state
  const boilerSpans = useAttributeTimeline(
    boilerEntity,
    "hvac_action",
    startTime,
    endTime,
  );

  // ACs: state is sufficient (heat/cool/off)
  const acIds = useMemo(() => acSystems.map((a) => a.entityId), [acSystems]);
  const acStateMap = useMultiStateHistory(acIds, startTime, endTime);

  // X-axis ticks every 3 hours (for chart labels)
  const ticks = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Array.from(
      { length: 9 },
      (_, i) => new Date(y, m - 1, d, i * 3).getTime(),
    );
  }, [dateStr]);

  // Hourly tick marks for timeline strips
  const hourlyTicks = useMemo(() => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Array.from(
      { length: 23 },
      (_, i) => new Date(y, m - 1, d, i + 1).getTime(),
    );
  }, [dateStr]);

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">
          Heating Monitor
        </h2>
        <DateNavigator dateStr={dateStr} onDateChange={setDateStr} />
      </div>

      {/* System timeline strips */}
      <div className="mb-4 space-y-1.5">
        <TimelineStrip
          label="Boiler"
          spans={boilerSpans}
          dayStart={dayStart}
          dayEnd={dayEnd}
          colorFn={boilerColor}
          hourlyTicks={hourlyTicks}
          yAxisWidth={YAXIS_WIDTH}
          marginRight={CHART_MARGIN_RIGHT}
        />
        {acSystems.map((ac) => (
          <TimelineStrip
            key={ac.entityId}
            label={ac.label}
            spans={acStateMap[ac.entityId] ?? []}
            dayStart={dayStart}
            dayEnd={dayEnd}
            colorFn={acColor}
            hourlyTicks={hourlyTicks}
            yAxisWidth={YAXIS_WIDTH}
            marginRight={CHART_MARGIN_RIGHT}
          />
        ))}
        {/* Shared time axis */}
        <div
          className="relative h-4 text-[9px] text-text-dim"
          style={{ marginLeft: YAXIS_WIDTH, marginRight: CHART_MARGIN_RIGHT }}
        >
          {ticks.map((t) => {
            const pct =
              ((t - dayStart) / (dayEnd - dayStart)) * 100;
            if (pct < 0 || pct > 100) return null;
            return (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {formatHour(t)}
              </span>
            );
          })}
        </div>
        {/* Runtime totals */}
        <RuntimeSummary
          items={[
            { label: "Boiler", ms: sumActiveSpanMs(boilerSpans, dayStart, dayEnd, (s) => boilerColor(s) !== null) },
            ...acSystems.map((ac) => ({
              label: ac.label,
              ms: sumActiveSpanMs(acStateMap[ac.entityId] ?? [], dayStart, dayEnd, (s) => acColor(s) !== null),
            })),
          ]}
          yAxisWidth={YAXIS_WIDTH}
        />
      </div>

      {/* Per-zone temperature charts */}
      <div className="space-y-3">
        {zones.map((zone) => {
          const sensorHistory = historyMap[zone.sensor] ?? [];
          const targetHistory = historyMap[zone.target] ?? [];
          const current = parseNumericState(entities[zone.sensor]?.state);
          const currentTarget = parseNumericState(
            entities[zone.target]?.state,
          );
          const acForZone = acSystems.find((a) => a.zoneId === zone.id);
          return (
            <ZoneChart
              key={zone.id}
              zone={zone}
              sensorHistory={sensorHistory}
              targetHistory={targetHistory}
              current={current}
              currentTarget={currentTarget}
              dayStart={dayStart}
              dayEnd={dayEnd}
              ticks={ticks}
              boilerSpans={boilerSpans}
              acSpans={acForZone ? (acStateMap[acForZone.entityId] ?? []) : undefined}
              entities={entities}
              isToday={isToday}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text-dim">
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-accent-warm/60" />
          Heat
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-accent-cool/60" />
          Cool
        </span>
      </div>

    </div>
  );
}
