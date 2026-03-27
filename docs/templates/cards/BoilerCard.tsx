/**
 * @file BoilerCard — Boiler status, flow/return temps, and modulation gauge.
 *
 * @ha-integration ebusd — local eBus gateway (NOT OpenTherm or generic climate integration)
 * @ha-helpers    input_select.climate_mode (controls Winter / Spring-Autumn / Summer / Off)
 * @ha-automation config/automations/climate.yaml — runs heating curve and zone TRV control
 *
 * Status strings are ebusd-specific values returned by your boiler's ebusd config.
 * Common values: "heating hot water", "circulating", "standby", "comfort".
 * The exact strings depend on your boiler model — check your ebusd message definitions.
 * Do NOT hardcode status strings without verifying against your specific ebusd config.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { BoilerConfig } from "../../lib/entities";
import { formatDuration } from "../../lib/format";
import {
  useAttributeTimeline,
  type StateSpan,
} from "../../hooks/useStateHistory";
import { useMinuteTick } from "../../hooks/useMinuteTick";

function num(entities: HassEntities, id: string): number | null {
  const s = entities[id]?.state;
  if (!s || s === "unavailable" || s === "unknown") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

interface BoilerCardProps {
  config: BoilerConfig;
}

export function BoilerCard({ config }: BoilerCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const maxKw = config.maxModulationKw ?? 24;

  const boilerEntity = entities[config.boilerEntity];
  const hvacAction = boilerEntity?.attributes?.hvac_action as
    | string
    | undefined;
  const boilerStatus = entities[config.boilerStatus]?.state ?? "unknown";
  const climateMode = entities[config.climateMode]?.state ?? "Off";
  const heatingEnabled = climateMode === "Winter" || climateMode === "Spring-Autumn";

  // Boiler states
  // ebusd status strings — these are model-specific values from your boiler's ebusd
  // message definitions, NOT standard HA climate states. Adjust for your boiler.
  const isDhw =
    boilerStatus === "heating hot water" || boilerStatus === "comfort";
  const isFiring = hvacAction === "heating" || isDhw;
  const isCirculating = boilerStatus === "circulating";
  const diverter = entities[config.boilerDiverter]?.state;

  // Telemetry
  const flowTemp = num(entities, config.boilerFlowTemp);
  const modulation = num(entities, config.boilerModulation);
  const targetFlow = num(entities, config.boilerTargetFlow);
  const outdoorTemp = num(entities, config.outdoorTemp);
  const dhwTarget = num(entities, config.boilerDhwTarget);
  const roomTemp = num(entities, config.roomTemp);
  const roomTarget = num(entities, config.roomTarget);

  // Today's heating runtime
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const boilerSpans = useAttributeTimeline(config.boilerEntity, "hvac_action", startOfToday);
  const isHeating = hvacAction === "heating";
  const now = useMinuteTick(isHeating);
  const sessionMs = useMemo(() => {
    if (!isHeating || boilerSpans.length === 0) return 0;
    const last = boilerSpans[boilerSpans.length - 1];
    if (last.state !== "heating") return 0;
    return now - last.start;
  }, [isHeating, boilerSpans, now]);
  const totalTodayMs = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return sumActiveTime(boilerSpans, dayStart.getTime(), now, (s) => s === "heating");
  }, [boilerSpans, now]);

  if (!boilerEntity || boilerEntity.state === "unavailable") return null;

  // --- DHW MODE ---
  if (isDhw) {
    return (
      <div className="contain-card rounded-2xl bg-bg-card p-4 space-y-3 ring-1 ring-accent-cool/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon="mdi:shower-head" width={22} style={{ animation: "glow-warm 2s ease-in-out infinite" }} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Hot Water</span>
                {heatingEnabled && (
                  <span className="text-[10px] text-text-dim">heating paused</span>
                )}
              </div>
              <span className="text-xs text-text-secondary">
                {dhwTarget != null ? `Target ${dhwTarget}°C` : ""}
                {flowTemp != null ? ` · ${flowTemp.toFixed(1)}°C` : ""}
              </span>
            </div>
          </div>
          {totalTodayMs > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-text-dim">Today</span>
              <div className="text-sm font-medium tabular-nums text-text-secondary">
                {formatDuration(totalTodayMs)}
              </div>
            </div>
          )}
        </div>
        {/* Power bar during DHW */}
        {modulation != null && modulation > 0 && (
          <div className="space-y-1">
            <div className="flex justify-end text-xs font-medium tabular-nums text-text-secondary">
              {modulation.toFixed(1)} kW
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(modulation / maxKw) * 100}%`,
                  background: "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-cool) 50%, transparent), var(--color-accent-cool))",
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- HEATING OFF ---
  if (!heatingEnabled) {
    return (
      <div className="contain-card rounded-2xl bg-bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon="mdi:water-boiler-off" width={22} className="text-text-dim" />
            <span className="text-sm text-text-dim">Heating off</span>
          </div>
          {outdoorTemp != null && (
            <span className="text-xs text-text-secondary tabular-nums">{outdoorTemp.toFixed(1)}°C outdoor</span>
          )}
        </div>
      </div>
    );
  }

  // --- HEATING ACTIVE (Winter / Spring-Autumn) ---
  const boilerLabel = isCirculating
    ? "circulating"
    : diverter === "dhw" && boilerStatus === "standby"
      ? "standby · after hot water"
      : boilerStatus;

  return (
    <div className={`contain-card rounded-2xl bg-bg-card p-4 space-y-3 ${isFiring ? "ring-1 ring-accent-warm/20" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon
            icon="mdi:water-boiler"
            width={22}
            className={isFiring ? "" : "text-text-dim"}
            style={isFiring ? { animation: "glow-warm 2s ease-in-out infinite" } : undefined}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Heating</span>
              {isHeating && sessionMs > 0 && (
                <span className="text-xs tabular-nums text-text-secondary">
                  {formatDuration(sessionMs)}
                </span>
              )}
            </div>
          </div>
        </div>
        {totalTodayMs > 0 && (
          <div className="text-right">
            <span className="text-[10px] text-text-dim">Today</span>
            <div className="text-sm font-medium tabular-nums text-text-secondary">
              {formatDuration(totalTodayMs)}
            </div>
          </div>
        )}
      </div>

      {/* Room temp vs target */}
      <div className="flex items-center gap-2 text-xs">
        <Icon icon="mdi:home-thermometer" width={14} className="text-text-secondary" />
        <span className="text-text-secondary">Room</span>
        <span className="font-medium tabular-nums">
          {roomTemp != null ? `${roomTemp.toFixed(1)}°` : "—"}
        </span>
        <Icon icon="mdi:arrow-right" width={12} className="text-text-dim" />
        <span className="text-text-secondary">target</span>
        <span className="font-medium tabular-nums">
          {roomTarget != null ? `${roomTarget.toFixed(1)}°` : "—"}
        </span>
        {outdoorTemp != null && (
          <span className="ml-auto text-text-dim tabular-nums">
            <Icon icon="mdi:weather-partly-cloudy" width={13} className="inline mr-1 align-[-2px]" />
            {outdoorTemp.toFixed(1)}°
          </span>
        )}
      </div>

      {/* Boiler state + flow target */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">
          Boiler: <span className={`capitalize ${isFiring ? "text-accent-warm font-medium" : "text-text-dim"}`}>{boilerLabel}</span>
        </span>
        {targetFlow != null && (
          <span className="text-text-secondary">
            Flow target: <span className="font-medium text-text-primary">{targetFlow}°C</span>
          </span>
        )}
      </div>

      {/* Power bar — only when firing */}
      {isFiring && (
        <div className="space-y-1">
          <div className="flex justify-end text-xs font-medium tabular-nums text-text-secondary">
            {modulation != null && modulation > 0 ? `${modulation.toFixed(1)} kW` : "starting..."}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            {modulation != null && modulation > 0 ? (
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(modulation / maxKw) * 100}%`,
                  background: "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-warm) 50%, transparent), var(--color-accent-warm))",
                }}
              />
            ) : (
              <div
                className="h-full w-full rounded-full opacity-30"
                style={{ background: "var(--color-accent-warm)", animation: "pulse 2s ease-in-out infinite" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function sumActiveTime(
  spans: StateSpan[],
  start: number,
  end: number,
  isActive: (state: string) => boolean,
): number {
  let ms = 0;
  for (const s of spans) {
    if (!isActive(s.state)) continue;
    const a = Math.max(s.start, start);
    const b = Math.min(s.end, end);
    if (a < b) ms += b - a;
  }
  return ms;
}
