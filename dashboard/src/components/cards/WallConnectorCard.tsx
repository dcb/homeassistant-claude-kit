import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState, formatPower, toWatts } from "../../lib/format";
import type { WallConnectorConfig } from "../../lib/entities";

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  charging:         { label: "Charging",        color: "text-accent-green",  icon: "mdi:lightning-bolt" },
  charging_reduced: { label: "Charging (reduced)", color: "text-accent-warm", icon: "mdi:lightning-bolt-outline" },
  ready:            { label: "Ready",            color: "text-accent",        icon: "mdi:ev-plug-type1" },
  connected:        { label: "Connected",        color: "text-accent",        icon: "mdi:ev-plug-type1" },
  waiting_car:      { label: "Waiting for car",  color: "text-accent-warm",   icon: "mdi:clock-outline" },
  negotiating:      { label: "Negotiating",      color: "text-accent-warm",   icon: "mdi:sync" },
  charging_finished:{ label: "Finished",         color: "text-text-secondary",icon: "mdi:check-circle-outline" },
  not_connected:    { label: "No car",           color: "text-text-dim",      icon: "mdi:ev-station" },
  booting:          { label: "Booting",          color: "text-text-dim",      icon: "mdi:power" },
  error:            { label: "Error",            color: "text-accent-red",    icon: "mdi:alert-circle-outline" },
};

interface WallConnectorCardProps {
  config: WallConnectorConfig;
}

export function WallConnectorCard({ config }: WallConnectorCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const status = entities[config.status]?.state ?? "unknown";
  const connected = entities[config.vehicleConnected]?.state === "on";
  const totalPowerE = entities[config.totalPower];
  const powerW = toWatts(totalPowerE?.state, totalPowerE?.attributes?.unit_of_measurement as string) ?? 0;
  const isCharging = status === "charging" || status === "charging_reduced";
  const sessionEnergy = parseNumericState(entities[config.sessionEnergy]?.state);

  const phaseA = parseNumericState(entities[config.phaseACurrent]?.state) ?? 0;
  const phaseB = parseNumericState(entities[config.phaseBCurrent]?.state) ?? 0;
  const phaseC = parseNumericState(entities[config.phaseCurrent]?.state) ?? 0;
  const showPhases = isCharging && (phaseA > 0.5 || phaseB > 0.5 || phaseC > 0.5);

  const info = STATUS_DISPLAY[status] ?? {
    label: status.replace(/_/g, " "),
    color: "text-text-dim",
    icon: "mdi:ev-station",
  };

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:ev-station" width={18} className="text-text-secondary" />
          <h2 className="text-sm font-medium text-text-secondary">Wall Connector</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${info.color}`}>
          <Icon icon={info.icon} width={14} />
          {info.label}
        </div>
      </div>

      {/* Power row */}
      <div className="flex items-end gap-4">
        <div>
          <div className={`text-2xl font-semibold tabular-nums ${isCharging ? "text-accent-green" : "text-text-dim"}`}>
            {isCharging ? formatPower(powerW) : "—"}
          </div>
          <div className="text-[11px] text-text-dim">Power</div>
        </div>

        {isCharging && sessionEnergy !== null && sessionEnergy > 0 && (
          <div>
            <div className="text-lg font-medium tabular-nums text-text-secondary">
              {sessionEnergy.toFixed(2)} kWh
            </div>
            <div className="text-[11px] text-text-dim">Session</div>
          </div>
        )}

        {!connected && (
          <div className="flex items-center gap-1.5 text-xs text-text-dim">
            <Icon icon="mdi:power-plug-off" width={14} />
            No vehicle connected
          </div>
        )}
      </div>

      {/* Phase currents */}
      {showPhases && (
        <div className="mt-3 flex gap-3 rounded-xl bg-bg-elevated px-3 py-2 text-xs text-text-dim">
          {[["A", phaseA], ["B", phaseB], ["C", phaseC]].map(([phase, amps]) => (
            <span key={phase as string} className="tabular-nums">
              L{phase}: <span className="font-medium text-text-secondary">{(amps as number).toFixed(1)}A</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
