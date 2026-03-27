/**
 * @file EVChargerCard — EV charging status and control card.
 *
 * @ha-integration OCPP 1.6 charger (NOT native Tesla Fleet integration —
 *   different entity structure and state strings)
 * @ha-helpers    input_select.charger_charge_control (values: Solar, Scheduled, Manual, Off)
 * @ha-helpers    input_number.ev_charge_min_watts
 * @ha-automation config/automations/tesla.yaml — reads charger_charge_control to set OCPP charge rate
 *
 * Connector state strings are OCPP 1.6 values (capital C): "Charging", "Available", "Preparing"
 * These differ from Tesla Fleet API sensor values (lowercase: "charging", "starting").
 *
 * lastEvRefresh cooldown: querying Tesla status wakes the car from sleep — the
 * cooldown prevents spurious wake-ups when the component re-mounts.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useCallback, useEffect, useRef } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState, toWatts, formatPower } from "../../lib/format";
import type { EvChargerConfig } from "../../lib/entities";
import { MODE_STATUS, ModeSelector } from "./ev-charger-constants";
import type { ChargeMode } from "./ev-charger-constants";
import { BatteryGauge } from "./BatteryGauge";
import { ManualControls } from "./ManualControls";

/* ── Visibility-gated EV refresh ───────────────────────────────── */

/** Module-level cooldown survives re-mounts and Strict Mode double-fire */
let lastEvRefresh = 0;
const EV_REFRESH_COOLDOWN_MS = 120_000; // 2 min

/* ── OCPP connector status → display info ─────────────────────── */

// OCPP 1.6 connector state values (capital C) — NOT Tesla Fleet API sensor values.
// Tesla Fleet uses lowercase: "charging", "starting", "stopped", "disconnected".
const CONNECTOR_STATES: Record<string, { label: string; color: string; icon: string }> = {
  Available:     { label: "Available",  color: "text-text-dim",       icon: "mdi:ev-station" },
  Preparing:     { label: "Preparing",  color: "text-accent-warm",    icon: "mdi:ev-plug-type2" },
  Charging:      { label: "Charging",   color: "text-accent-green",   icon: "mdi:lightning-bolt" },
  SuspendedEVSE: { label: "Paused",     color: "text-accent-warm",    icon: "mdi:pause-circle" },
  SuspendedEV:   { label: "Paused (car)", color: "text-accent-warm",  icon: "mdi:pause-circle" },
  Finishing:     { label: "Finishing",   color: "text-text-secondary", icon: "mdi:check-circle" },
};

interface EVChargerCardProps {
  config: EvChargerConfig;
}

/* ── Main component ───────────────────────────────────────────── */

export function EVChargerCard({ config }: EVChargerCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const connRef = useRef(connection);
  connRef.current = connection;

  // ── Charger state (OCPP — always available) ──────────────────
  const connectorStatus = entities[config.chargerStatus]?.state ?? "unavailable";
  const ocppCharging = connectorStatus === "Charging";
  const ocppPluggedIn = !["Available", "unavailable", "unknown"].includes(connectorStatus);
  const connectorInfo = CONNECTOR_STATES[connectorStatus] ?? {
    label: connectorStatus, color: "text-text-dim", icon: "mdi:help-circle",
  };

  // Power: prefer metered import, fall back to offered when import reads 0 during charging
  const importPowerE = entities[config.chargerPower];
  const importPowerW = toWatts(importPowerE?.state, importPowerE?.attributes?.unit_of_measurement as string);
  const offeredPowerE = entities[config.chargerPowerOffered];
  const offeredPowerW = toWatts(offeredPowerE?.state, offeredPowerE?.attributes?.unit_of_measurement as string);
  const chargerPowerW = (importPowerW !== null && importPowerW > 0)
    ? importPowerW
    : (ocppCharging ? offeredPowerW : importPowerW);

  const currentOffered = parseNumericState(entities[config.chargerCurrentOffered]?.state);
  const sessionEnergy = parseNumericState(entities[config.chargerSessionEnergy]?.state);

  // Mode selector (HA helper — independent of any car integration)
  const mode = (entities[config.evChargeMode]?.state ?? "Off") as ChargeMode;
  const maxWatts = parseNumericState(entities[config.solarChargerMaxWatts]?.state);

  // ── EV (car-side — may be unavailable) ──────────────────────
  const evAvailable = entities[config.evBattery]?.state !== undefined
    && entities[config.evBattery]?.state !== "unavailable";
  const battery = parseNumericState(entities[config.evBattery]?.state);
  const usableBattery = parseNumericState(entities[config.evUsableBattery]?.state);
  const chargeLimit = parseNumericState(entities[config.evChargeLimit]?.state);
  const energyAdded = parseNumericState(entities[config.evChargeEnergy]?.state);
  const timeToFull = entities[config.evTimeToFull]?.state;
  const estRangeEntity = entities[config.evEstRange];
  const estRangeMiles = parseNumericState(estRangeEntity?.state);
  const estRangeUnit = estRangeEntity?.attributes?.unit_of_measurement as string | undefined;
  const estRangeKm = estRangeMiles !== null
    ? (estRangeUnit === "mi" ? Math.round(estRangeMiles * 1.60934) : Math.round(estRangeMiles))
    : null;
  const batteryHeaterOn = entities[config.evBatteryHeater]?.state === "on";
  const scheduledPending = entities[config.evScheduledPending]?.state === "on";
  const scheduledActive = entities[config.evScheduledActive]?.state === "on";
  const coldGap = battery !== null && usableBattery !== null ? battery - usableBattery : 0;

  // Charging detection: OCPP is primary, car sensor is supplementary
  const evChargingState = entities[config.evCharging]?.state;
  const isCharging = ocppCharging
    || evChargingState === "charging"
    || evChargingState === "starting";

  // Cable: OCPP connector is primary, car cable sensor is supplementary
  const cableConnected = ocppPluggedIn || entities[config.evChargeCable]?.state === "on";

  // Manual mode: OCPP watts control + OCPP charge control switch
  const manualWatts = parseNumericState(entities[config.evChargeManualWatts]?.state);
  const ocppChargeSwitch = entities[config.chargerChargeControl]?.state === "on";

  /* ── Service helpers ──────────────────────────────────────── */

  const setMode = useCallback((m: ChargeMode) => {
    if (!connection || m === mode) return;
    callService(connection, "input_select", "select_option", { option: m }, {
      entity_id: config.evChargeMode,
    });
  }, [connection, mode, config.evChargeMode]);

  const toggleOcppCharging = useCallback(() => {
    if (!connection) return;
    callService(connection, "switch", ocppChargeSwitch ? "turn_off" : "turn_on", {}, {
      entity_id: config.chargerChargeControl,
    });
  }, [connection, ocppChargeSwitch, config.chargerChargeControl]);

  const setManualWatts = useCallback((watts: number) => {
    if (!connection) return;
    callService(connection, "input_number", "set_value", { value: watts }, {
      entity_id: config.evChargeManualWatts,
    });
  }, [connection, config.evChargeManualWatts]);

  const setChargeLimit = useCallback((limit: number) => {
    if (!connection) return;
    callService(connection, "number", "set_value", { value: limit }, {
      entity_id: config.evChargeLimit,
    });
  }, [connection, config.evChargeLimit]);

  // Force-refresh EV entities when returning from background.
  // Module-level cooldown prevents API spam from rapid tab switches.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastEvRefresh < EV_REFRESH_COOLDOWN_MS) return;
      const conn = connRef.current;
      if (!conn) return;
      lastEvRefresh = now;
      callService(conn, "homeassistant", "update_entity", {
        entity_id: [config.evBattery],
      });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [config.evBattery]);

  /* ── Battery bar color ────────────────────────────────────── */

  const batteryColor =
    battery !== null && battery < 20 ? "bg-accent-red"
      : battery !== null && battery < 40 ? "bg-accent-warm"
        : "bg-accent-green";

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-4">
      {/* ── Charger section (OCPP — always works) ─────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">EV Charger</h2>
        <div className={`flex items-center gap-1 text-xs ${connectorInfo.color}`}>
          <Icon icon={connectorInfo.icon} width={14} />
          {connectorInfo.label}
        </div>
      </div>

      {/* Charging stats from OCPP */}
      {isCharging && (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2 text-sm">
            {chargerPowerW !== null && (
              <span className="tabular-nums">
                <span className="text-text-dim">Power:</span>{" "}
                <span className="font-medium">{formatPower(chargerPowerW)}</span>
              </span>
            )}
            {currentOffered !== null && currentOffered > 0 && (
              <span className="tabular-nums">
                <span className="text-text-dim">Rate:</span>{" "}
                <span className="font-medium">{Math.round(currentOffered)}A</span>
              </span>
            )}
            {maxWatts !== null && mode === "Solar" && (
              <span className="tabular-nums text-xs text-text-dim">
                (max {formatPower(maxWatts)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 px-3 text-xs text-text-secondary">
            {sessionEnergy !== null && sessionEnergy > 0 && (
              <span className="tabular-nums">
                +{sessionEnergy.toFixed(1)} kWh
              </span>
            )}
            {energyAdded !== null && energyAdded > 0 && sessionEnergy !== null && sessionEnergy > 0 && (
              <span className="tabular-nums text-text-dim">
                (car: +{energyAdded.toFixed(1)} kWh)
              </span>
            )}
            {timeToFull && timeToFull !== "unknown" && timeToFull !== "unavailable" && (
              <span className="tabular-nums">
                Ready {new Date(timeToFull).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cable status */}
      {!cableConnected && (
        <div className="mb-3 flex items-center gap-2 text-xs text-text-dim">
          <Icon icon="mdi:power-plug-off" width={14} />
          Cable not connected
        </div>
      )}

      {/* Charger controls — mode selector always visible */}
      <div className="space-y-3">
        <ModeSelector current={mode} onSelect={setMode} />
        <p className="px-1 text-xs text-text-dim">
          {MODE_STATUS[mode]?.(isCharging) ?? connectorStatus}
        </p>

        {/* Manual mode: watts slider + start/stop (only when plugged in) */}
        {mode === "Manual" && cableConnected && (
          <ManualControls
            watts={manualWatts}
            isCharging={isCharging}
            chargeSwitch={ocppChargeSwitch}
            onWattsChange={setManualWatts}
            onToggle={toggleOcppCharging}
          />
        )}
      </div>

      {/* ── EV section (car-side — only when available) ─────────── */}
      {evAvailable && (
        <div className={cableConnected ? "mt-4 border-t border-border pt-4" : ""}>
          <h3 className="mb-2 text-xs font-medium text-text-dim">{config.carLabel ?? "EV"}</h3>

          <BatteryGauge
            battery={battery}
            usableBattery={usableBattery}
            chargeLimit={chargeLimit}
            batteryColor={batteryColor}
            isCharging={isCharging}
            estRangeKm={estRangeKm}
            onChargeLimitChange={setChargeLimit}
          />

          {/* Badges row: cold weather, scheduled charge */}
          {(batteryHeaterOn || scheduledPending || scheduledActive) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {batteryHeaterOn && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-accent-warm/15 px-2 py-0.5 text-[11px] font-medium text-accent-warm">
                  <Icon icon="mdi:thermometer-alert" width={12} />
                  Battery heating{coldGap > 0 ? ` (−${Math.round(coldGap)}% cold buffer)` : ""}
                </span>
              )}
              {(scheduledPending || scheduledActive) && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  <Icon icon="mdi:calendar-clock" width={12} />
                  Scheduled charge{scheduledActive ? " (active)" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
