import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { formatPower, toWatts } from "../../lib/format";
import type { EnergyConfig } from "../../lib/entities";

interface PowerFlowCardProps {
  config: EnergyConfig;
}

/**
 * @file PowerFlowCard — Real-time solar / grid / load power flow display.
 *
 * @ha-integration Huawei Solar (local LAN Modbus integration — NOT FusionSolar cloud)
 * @ha-integration OCPP 1.6 charger (optional — for EV charging display)
 *
 * Solar and load readings come from the same Huawei Modbus poll (consistent with
 * each other). Charger power comes from OCPP MeterValues (real-time, local), with
 * fallback to chargerPowerOffered when import reads 0 during an active session.
 *
 * House load = total load − charger power (when charger is active).
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
export function PowerFlowCard({ config }: PowerFlowCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const solarE = entities[config.solarPower];
  const loadE = entities[config.loadPower];
  const chargerImportE = entities[config.chargerPowerImport];
  const chargerOfferedE = entities[config.chargerPowerOffered];

  const solarW = toWatts(solarE?.state, solarE?.attributes?.unit_of_measurement as string) ?? 0;
  const totalLoadW = toWatts(loadE?.state, loadE?.attributes?.unit_of_measurement as string) ?? 0;
  const importW = toWatts(chargerImportE?.state, chargerImportE?.attributes?.unit_of_measurement as string) ?? 0;
  const offeredW = toWatts(chargerOfferedE?.state, chargerOfferedE?.attributes?.unit_of_measurement as string) ?? 0;

  // Charger status from OCPP connector state
  const connectorState = entities[config.chargerStatus]?.state;
  const isOcppCharging = connectorState === "Charging";
  // Use metered import when available, fall back to offered during active session
  const chargerW = importW > 50 ? importW : (isOcppCharging ? offeredW : 0);
  const isCharging = isOcppCharging && chargerW > 50;
  const pluggedIn = connectorState !== undefined && connectorState !== "Available";

  // Pure house consumption = total load minus charger
  const houseW = isCharging ? Math.max(0, totalLoadW - chargerW) : totalLoadW;

  // Grid: solar minus total load (both from Huawei — consistent)
  const gridW = solarW - totalLoadW;
  const isExporting = gridW > 50;
  const isImporting = gridW < -50;

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      {/* Solar — top center */}
      <div className="flex items-center justify-center gap-2">
        <Icon icon="mdi:solar-power" width={20} className="text-accent-warm" />
        <span className="text-2xl font-semibold tabular-nums text-accent-warm">
          {formatPower(solarW)}
        </span>
      </div>

      {/* Flow arrows */}
      <div className="my-2 flex justify-center gap-6 text-xs text-text-dim">
        <span className="animate-pulse">↓</span>
        {isExporting && <span className="animate-pulse text-accent-green">↓</span>}
        {isImporting && <span className="animate-pulse text-accent-red">↑</span>}
      </div>

      {/* Destinations row */}
      <div className="grid grid-cols-3 gap-2">
        {/* House (total load minus charger) */}
        <FlowNode
          icon="mdi:home"
          label="House"
          value={formatPower(houseW)}
          color="text-accent"
          bgClass="bg-indigo-950/30"
        />

        {/* Grid (solar - load, both Huawei = consistent) */}
        <FlowNode
          icon="mdi:transmission-tower"
          label={isExporting ? "Export" : isImporting ? "Import" : "Grid"}
          value={formatPower(Math.abs(gridW))}
          color={isExporting ? "text-accent-green" : isImporting ? "text-accent-red" : "text-text-dim"}
          bgClass={
            isExporting ? "bg-emerald-950/30" : isImporting ? "bg-red-950/30" : "bg-bg-elevated"
          }
        />

        {/* Charger (EVSE) */}
        <FlowNode
          icon="mdi:ev-station"
          label={isCharging ? "Charger" : pluggedIn ? "Plugged in" : "Charger"}
          value={isCharging ? formatPower(chargerW) : "—"}
          color={isCharging ? "text-accent-green" : "text-text-dim"}
          bgClass={isCharging ? "bg-emerald-950/30" : "bg-bg-elevated"}
        />
      </div>
    </div>
  );
}

function FlowNode({
  icon,
  label,
  value,
  color,
  bgClass,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bgClass: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-2 py-2.5 ${bgClass}`}>
      <Icon icon={icon} width={18} className={color} />
      <span className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-text-dim">{label}</span>
    </div>
  );
}
