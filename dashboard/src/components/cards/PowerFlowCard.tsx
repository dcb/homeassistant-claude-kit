/**
 * @file PowerFlowCard — Real-time 4-node Powerwall power flow display.
 *
 * @ha-integration Tesla Powerwall (via powerwall2 integration or Tesla Fleet)
 *
 * Readings: solar, load, grid (site_now), and battery (battery_now) all come
 * from the Powerwall gateway — consistent snapshot values.
 *
 * Powerwall sign conventions:
 *   site_now   > 0 → exporting to grid; < 0 → importing from grid
 *   battery_now > 0 → battery charging; < 0 → battery discharging
 *
 * House load shown = total load − charger power when the Tesla is charging.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { formatPower, toWatts, parseNumericState } from "../../lib/format";
import type { EnergyConfig } from "../../lib/entities";

export interface PowerFlowCardProps {
  config: EnergyConfig;
}

export function PowerFlowCard({ config }: PowerFlowCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const solarE = entities[config.solarPower];
  const loadE = entities[config.loadPower];
  const gridE = entities[config.gridNow];
  const batteryE = entities[config.batteryNow];
  const batteryChargeE = entities[config.batteryCharge];
  const batteryBackupE = entities[config.batteryBackup];
  const chargerPowerE = entities[config.chargerPowerImport];

  const solarW = toWatts(solarE?.state, solarE?.attributes?.unit_of_measurement as string | undefined) ?? 0;
  const totalLoadW = toWatts(loadE?.state, loadE?.attributes?.unit_of_measurement as string | undefined) ?? 0;
  // site_now: positive = exporting, negative = importing
  const gridW = toWatts(gridE?.state, gridE?.attributes?.unit_of_measurement as string | undefined) ?? 0;
  // battery_now: positive = charging, negative = discharging
  const batteryW = toWatts(batteryE?.state, batteryE?.attributes?.unit_of_measurement as string | undefined) ?? 0;
  const batteryCharge = parseNumericState(batteryChargeE?.state);
  const batteryBackup = parseNumericState(batteryBackupE?.state);

  // EV charger state (binary_sensor: "on" = charging)
  const isEvCharging = entities[config.chargerStatus]?.state === "on";
  const chargerW = isEvCharging
    ? (toWatts(chargerPowerE?.state, chargerPowerE?.attributes?.unit_of_measurement as string | undefined) ?? 0)
    : 0;

  // Grid status
  const gridOnline = entities[config.gridStatus]?.state !== "off";

  // House = total load minus EV charger
  const houseW = isEvCharging ? Math.max(0, totalLoadW - chargerW) : totalLoadW;

  // Grid flow direction
  const isExporting = gridW > 50;
  const isImporting = gridW < -50;

  // Battery flow direction
  const isBatteryCharging = batteryW > 50;
  const isBatteryDischarging = batteryW < -50;

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      {/* Solar — top center */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:solar-power" width={20} className="text-accent-warm" />
          <span className="text-2xl font-semibold tabular-nums text-accent-warm">
            {formatPower(solarW)}
          </span>
        </div>
        <span className="text-[10px] text-text-dim">Solar production</span>
      </div>

      {/* Flow arrows — animated directional indicators */}
      <div className="my-2 flex items-center justify-center gap-8 text-sm">
        {/* Solar → House */}
        <span className="animate-pulse text-accent-warm">↓</span>
        {/* Grid flow */}
        {isExporting && (
          <span className="animate-pulse text-accent-green">↑</span>
        )}
        {isImporting && (
          <span className="animate-pulse text-accent-red">↓</span>
        )}
        {/* Battery flow */}
        {isBatteryCharging && (
          <span className="animate-pulse text-accent-warm">→</span>
        )}
        {isBatteryDischarging && (
          <span className="animate-pulse text-accent-violet">←</span>
        )}
      </div>

      {/* Bottom row: Grid | Battery | House */}
      <div className="grid grid-cols-3 gap-2">
        {/* Grid node */}
        <FlowNode
          icon={gridOnline ? "mdi:transmission-tower" : "mdi:transmission-tower-off"}
          label={
            !gridOnline
              ? "Grid off"
              : isExporting
                ? "Exporting"
                : isImporting
                  ? "Importing"
                  : "Grid"
          }
          value={Math.abs(gridW) > 10 ? formatPower(Math.abs(gridW)) : "—"}
          color={
            !gridOnline
              ? "text-text-dim"
              : isExporting
                ? "text-accent-green"
                : isImporting
                  ? "text-accent-red"
                  : "text-text-dim"
          }
          bgClass={
            !gridOnline
              ? "bg-bg-elevated"
              : isExporting
                ? "bg-emerald-950/30"
                : isImporting
                  ? "bg-red-950/30"
                  : "bg-bg-elevated"
          }
        />

        {/* Battery node */}
        <div
          className={`flex flex-col items-center rounded-xl px-2 py-2.5 ${
            isBatteryCharging
              ? "bg-amber-950/30"
              : isBatteryDischarging
                ? "bg-violet-950/30"
                : "bg-bg-elevated"
          }`}
        >
          <Icon
            icon={
              isBatteryCharging
                ? "mdi:battery-charging"
                : isBatteryDischarging
                  ? "mdi:battery-arrow-down"
                  : "mdi:battery"
            }
            width={18}
            className={
              isBatteryCharging
                ? "text-accent-warm"
                : isBatteryDischarging
                  ? "text-accent-violet"
                  : "text-text-dim"
            }
          />
          <span
            className={`mt-1 text-sm font-semibold tabular-nums ${
              isBatteryCharging
                ? "text-accent-warm"
                : isBatteryDischarging
                  ? "text-accent-violet"
                  : "text-text-dim"
            }`}
          >
            {Math.abs(batteryW) > 10 ? formatPower(Math.abs(batteryW)) : "—"}
          </span>
          <span className="text-[10px] text-text-dim">
            {batteryCharge !== null ? `${Math.round(batteryCharge)}%` : "Battery"}
            {batteryBackup !== null && batteryCharge !== null && (
              <span className="ml-0.5 opacity-60">
                {" "}
                ({Math.round(batteryBackup)}% rsv)
              </span>
            )}
          </span>
        </div>

        {/* House node — shows load minus EV charger */}
        <FlowNode
          icon="mdi:home"
          label={isEvCharging ? "House" : "Load"}
          value={formatPower(houseW)}
          color="text-accent"
          bgClass="bg-indigo-950/30"
        />
      </div>

      {/* EV charging row — only when active */}
      {isEvCharging && chargerW > 10 && (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-950/30 px-3 py-1.5 text-xs text-accent-green">
          <Icon icon="mdi:car-electric" width={14} />
          <span className="tabular-nums">
            Tesla charging · {formatPower(chargerW)}
          </span>
        </div>
      )}
    </div>
  );
}

interface FlowNodeProps {
  icon: string;
  label: string;
  value: string;
  color: string;
  bgClass: string;
}

function FlowNode({ icon, label, value, color, bgClass }: FlowNodeProps) {
  return (
    <div className={`flex flex-col items-center rounded-xl px-2 py-2.5 ${bgClass}`}>
      <Icon icon={icon} width={18} className={color} />
      <span className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] text-text-dim">{label}</span>
    </div>
  );
}
