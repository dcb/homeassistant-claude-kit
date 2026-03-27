import { lazy, Suspense, useMemo, useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState, formatTemp, formatDuration } from "../../lib/format";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import { useMultiHistory } from "../../hooks/useHistory";
import { useAttributeTimeline, useMultiStateHistory } from "../../hooks/useStateHistory";
import type { StateSpan } from "../../hooks/useStateHistory";
import { Sparkline } from "../charts/Sparkline";

const ZoneHistoryPopup = lazy(() =>
  import("../popups/ZoneHistoryPopup").then((m) => ({ default: m.ZoneHistoryPopup })),
);

interface ZoneCardProps {
  name: string;
  sensorId: string;
  targetId: string;
  boilerEntity: string;
  climateIds?: string[];
  trvIds?: string[];
}

export function ZoneCard({ name, sensorId, targetId, boilerEntity, climateIds, trvIds }: ZoneCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [popupOpen, setPopupOpen] = useState(false);

  const current = parseNumericState(entities[sensorId]?.state);
  const target = parseNumericState(entities[targetId]?.state);

  // TRV heating state
  const totalTrvs = trvIds?.length ?? 0;
  const heatingTrvIds = trvIds?.filter((id) => entities[id]?.state === "heat") ?? [];
  const heatingCount = heatingTrvIds.length;

  // Tick every minute for live duration when heating
  const now = useMinuteTick(heatingCount > 0);

  // Duration since earliest heating TRV started
  let heatingDuration: string | null = null;
  if (heatingCount > 0) {
    const times = heatingTrvIds
      .map((id) => {
        const lc = entities[id]?.last_changed;
        return lc ? new Date(lc).getTime() : 0;
      })
      .filter((t) => t > 0);
    if (times.length > 0) {
      const ms = now - Math.min(...times);
      if (ms > 0) heatingDuration = formatDuration(ms);
    }
  }

  // Stable start time: 24 hours ago (recalculates only on mount)
  const startTime = useMemo(() => {
    const d = new Date();
    d.setTime(d.getTime() - 24 * 60 * 60 * 1000);
    return d.toISOString();
  }, []);
  const historyMap = useMultiHistory([sensorId, targetId], startTime);
  const sensorHistory = historyMap[sensorId] ?? [];
  const targetHistory = historyMap[targetId] ?? [];

  // Boiler and AC state history for sparkline bands
  const boilerSpans = useAttributeTimeline(boilerEntity, "hvac_action", startTime);
  const acIds = useMemo(() => climateIds ?? [], [climateIds]);
  const acStateMap = useMultiStateHistory(acIds, startTime);
  const heatingSpans = useMemo(
    () => boilerSpans.filter((s) => s.state === "heating"),
    [boilerSpans],
  );
  const acActiveSpans = useMemo((): StateSpan[] => {
    const spans: StateSpan[] = [];
    for (const id of acIds) {
      const idSpans = acStateMap[id] ?? [];
      spans.push(
        ...idSpans.filter(
          (s) => s.state === "heat" || s.state === "cool" || s.state === "dry",
        ),
      );
    }
    return spans.sort((a, b) => a.start - b.start);
  }, [acStateMap, acIds]);

  // Determine background tint based on delta from target
  const bgClass = getBgClass(current, target);

  // Check if any climate device in this zone is actively heating/cooling
  // TRVs: state "heat" means automation determined room needs heating
  // ACs: use hvac_action (reliable on inverter units)
  const activeAction = climateIds
    ?.map((id) => {
      const e = entities[id];
      if (!e) return undefined;
      if (id.includes("radiator")) {
        return e.state === "heat" ? "heating" : undefined;
      }
      const action = e.attributes?.hvac_action as string | undefined;
      return action && action !== "idle" && action !== "off" ? action : undefined;
    })
    .find((a) => a != null);

  // Pick sparkline color based on zone state
  const sparkColor =
    current !== null && target !== null
      ? current - target < -0.5
        ? "var(--color-accent-blue)"  // blue — cold
        : current - target > 0.5
          ? "var(--color-accent-red)"  // red — warm
          : "var(--color-accent-green)"  // green — on target
      : "var(--color-accent)";   // default accent

  return (
    <>
      <button
        onClick={() => setPopupOpen(true)}
        className={`min-w-0 w-full overflow-hidden rounded-2xl p-4 text-left transition-colors ${bgClass} hover:brightness-110 active:scale-[0.98]`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-text-secondary">{name}</h3>
              {/* TRV indicator: grayed when idle, glow-warm when heating */}
              {totalTrvs > 0 && (
                <span
                  className={`flex items-center gap-0.5 text-xs tabular-nums ${
                    heatingCount > 0 ? "" : "text-text-dim"
                  }`}
                  style={
                    heatingCount > 0
                      ? { animation: "glow-warm 2s ease-in-out infinite" }
                      : undefined
                  }
                >
                  <Icon icon="lucide:heater" width={12} />
                  {heatingCount > 0
                    ? `${heatingCount}/${totalTrvs}`
                    : totalTrvs}
                </span>
              )}
            </div>
            {heatingDuration && (
              <span className="text-[10px] tabular-nums text-text-dim">
                {heatingDuration}
              </span>
            )}
            {activeAction && (
              <span className="mt-0.5 flex items-center gap-1 text-xs capitalize">
                <Icon
                  icon={activeAction === "heating" ? "mdi:fire" : "mdi:snowflake"}
                  width={12}
                  className={activeAction === "heating" ? "text-accent-warm" : "text-accent-cool"}
                />
                <span className={activeAction === "heating" ? "text-accent-warm" : "text-accent-cool"}>
                  {activeAction}
                </span>
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums leading-tight">
              {current !== null ? `${current.toFixed(1)}°` : "—"}
            </div>
            {target !== null && (
              <div className="mt-0.5 flex items-center justify-end gap-0.5 text-xs tabular-nums text-text-dim">
                <Icon icon="mdi:target" width={10} />
                {formatTemp(entities[targetId]?.state)}°
              </div>
            )}
          </div>
        </div>

        {sensorHistory.length >= 2 && (
          <div className="mt-2">
            <Sparkline
              data={sensorHistory}
              targetData={targetHistory}
              color={sparkColor}
              boilerSpans={heatingSpans}
              acSpans={acActiveSpans}
            />
          </div>
        )}
      </button>

      {popupOpen && (
        <Suspense fallback={null}>
          <ZoneHistoryPopup
            open={popupOpen}
            onClose={() => setPopupOpen(false)}
            name={name}
            sensorId={sensorId}
            targetId={targetId}
            boilerEntity={boilerEntity}
            climateIds={climateIds}
          />
        </Suspense>
      )}
    </>
  );
}

function getBgClass(current: number | null, target: number | null): string {
  if (current === null || target === null) return "bg-bg-card";
  const delta = current - target;
  if (delta < -1.5) return "bg-blue-950/40";      // cold
  if (delta < -0.5) return "bg-blue-950/20";       // slightly cold
  if (delta > 1.5) return "bg-red-950/40";         // hot
  if (delta > 0.5) return "bg-red-950/20";         // slightly warm
  return "bg-emerald-950/20";                       // at target
}
