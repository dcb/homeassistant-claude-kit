import { lazy, Suspense, useMemo, useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState, toWatts, formatPower, formatDuration } from "../../lib/format";
import type { AcConfig } from "../../lib/acUnits";
import {
  useAttributeTimeline,
  type StateSpan,
} from "../../hooks/useStateHistory";
import { useMinuteTick } from "../../hooks/useMinuteTick";

const AcControlPopup = lazy(() =>
  import("../popups/AcControlPopup").then((m) => ({ default: m.AcControlPopup })),
);

interface AcStatusProps {
  acUnits: AcConfig[];
  sparePower: string;
}

export function AcStatus({ acUnits, sparePower }: AcStatusProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [popupAc, setPopupAc] = useState<AcConfig | null>(null);

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const spareE = entities[sparePower];
  const sparePowerW = toWatts(spareE?.state, spareE?.attributes?.unit_of_measurement as string);

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">Air Conditioning</h2>
        {sparePowerW !== null && (
          <span className="flex items-center gap-1 text-xs text-text-dim">
            <Icon icon="mdi:solar-power" width={14} className="text-accent-warm" />
            {formatPower(sparePowerW)} spare
          </span>
        )}
      </div>

      <div className="space-y-2">
        {acUnits.map((ac) => (
          <AcRow
            key={ac.entity}
            ac={ac}
            entities={entities}
            onOpenPopup={() => setPopupAc(ac)}
            startOfToday={startOfToday}
          />
        ))}
      </div>

      {/* AC Control Popup */}
      {popupAc && (
        <Suspense fallback={null}>
          <AcControlPopup
            ac={popupAc}
            open={!!popupAc}
            onClose={() => setPopupAc(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

// --- HVAC mode icon/color helpers ---

const HVAC_MODE_META: Record<string, { icon: string; color: string; label: string }> = {
  heat: { icon: "mdi:fire", color: "text-accent-warm", label: "Heat" },
  cool: { icon: "mdi:snowflake", color: "text-accent-cool", label: "Cool" },
  dry: { icon: "mdi:water-percent", color: "text-teal-400", label: "Dry" },
  fan_only: { icon: "mdi:fan", color: "text-sky-400", label: "Fan" },
  auto: { icon: "mdi:thermostat-auto", color: "text-emerald-400", label: "Auto" },
  heat_cool: { icon: "mdi:thermostat-auto", color: "text-emerald-400", label: "Auto" },
  off: { icon: "mdi:power", color: "text-text-dim", label: "Off" },
};

function getHvacMeta(mode: string) {
  return HVAC_MODE_META[mode] ?? { icon: "mdi:air-conditioner", color: "text-text-dim", label: mode };
}

// --- Per-AC row ---

function AcRow({
  ac,
  entities,
  onOpenPopup,
  startOfToday,
}: {
  ac: AcConfig;
  entities: HassEntities;
  onOpenPopup: () => void;
  startOfToday: string;
}) {
  const entity = entities[ac.entity];
  const hvacAction = entity?.attributes?.hvac_action as string | undefined;
  const hvacMode = entity?.state ?? "unavailable";
  const currentTemp = parseNumericState(entity?.attributes?.current_temperature as string | undefined);
  const acTarget = parseNumericState(entity?.attributes?.temperature as string | undefined);
  const zoneTarget = parseNumericState(entities[ac.zoneTargetEntity]?.state);
  const isManual = entities[ac.manualEntity]?.state === "on";
  // Show AC's own target in manual mode, zone target in auto
  const displayTarget = isManual ? acTarget : zoneTarget;

  const isActive = !!(hvacAction && hvacAction !== "idle" && hvacAction !== "off");
  const modeMeta = getHvacMeta(hvacMode);

  // Timer remaining
  const timerE = entities[ac.timerEntity];
  const timerRemaining = isManual ? getTimerRemaining(timerE) : null;

  // Runtime tracking via hvac_action history
  const actionSpans = useAttributeTimeline(ac.entity, "hvac_action", startOfToday);
  const now = useMinuteTick(isActive);

  // Current session duration
  const sessionDuration = useMemo(() => {
    if (!isActive || actionSpans.length === 0) return null;
    const last = actionSpans[actionSpans.length - 1];
    if (last.state === "idle" || last.state === "off") return null;
    const ms = now - last.start;
    return ms > 0 ? formatDuration(ms) : null;
  }, [isActive, actionSpans, now]);

  // Total runtime today
  const totalTodayMs = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return sumActiveTime(actionSpans, dayStart.getTime(), now);
  }, [actionSpans, now]);

  return (
    <button
      onClick={onOpenPopup}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/8 active:bg-white/8 ${
        isActive ? "bg-bg-elevated ring-1 ring-white/10" : "bg-bg-elevated"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{ac.label}</span>
            {/* HVAC mode icon + action + session duration */}
            <span className={`flex items-center gap-0.5 text-xs ${modeMeta.color}`}>
              <Icon icon={modeMeta.icon} width={13} />
              {hvacMode !== "off" && isActive && (
                <>
                  <span className="capitalize">{hvacAction}</span>
                  {sessionDuration && (
                    <span className="text-text-secondary">· {sessionDuration}</span>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-dim">{ac.sublabel}</span>
            {isManual && (
              <span className="flex items-center gap-1 text-xs text-accent-warm">
                <Icon icon="mdi:hand-back-right" width={10} />
                Manual
                {timerRemaining && (
                  <span className="text-text-dim">· {timerRemaining}</span>
                )}
              </span>
            )}
            {totalTodayMs > 0 && (
              <span className="text-xs tabular-nums text-text-dim">
                Today {formatDuration(totalTodayMs)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            {currentTemp !== null && (
              <div className="text-sm tabular-nums">{currentTemp.toFixed(1)}°</div>
            )}
            {displayTarget !== null && hvacMode !== "off" && (
              <div className="flex items-center justify-end gap-0.5 text-xs text-text-dim tabular-nums">
                <Icon icon={isManual ? "mdi:thermostat" : "mdi:target"} width={10} />
                {displayTarget.toFixed(1)}°
              </div>
            )}
            {hvacMode === "off" && (
              <span className="text-xs text-text-dim">Off</span>
            )}
          </div>
          <Icon icon="mdi:chevron-right" width={16} className="text-text-dim" />
        </div>
      </div>
    </button>
  );
}

function sumActiveTime(
  spans: StateSpan[],
  start: number,
  end: number,
): number {
  let ms = 0;
  for (const s of spans) {
    if (s.state === "idle" || s.state === "off") continue;
    const a = Math.max(s.start, start);
    const b = Math.min(s.end, end);
    if (a < b) ms += b - a;
  }
  return ms;
}

/** Extract remaining time from a timer entity. */
function getTimerRemaining(timerEntity: HassEntities[string] | undefined): string | null {
  if (!timerEntity || timerEntity.state !== "active") return null;
  const finishesAt = timerEntity.attributes?.finishes_at as string | undefined;
  if (!finishesAt) return null;
  const remaining = new Date(finishesAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
