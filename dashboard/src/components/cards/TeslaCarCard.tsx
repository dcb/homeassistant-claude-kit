/**
 * @file TeslaCarCard — Tesla Fleet API EV status and charging control card.
 *
 * @ha-integration Tesla Fleet (native HA integration — NOT OCPP charger)
 *
 * State strings are Tesla Fleet API values (lowercase): "on"/"off" for binary sensors,
 * numeric values for sensors. Differs from OCPP state strings ("Charging", "Available").
 *
 * Toggle charging via switch.asterix_charger. Set charge limit via number.asterix_charge_limit.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState, toWatts, formatPower } from "../../lib/format";
import type { EvStatusConfig } from "../../lib/entities";
import { useControlCommit } from "../../lib/useControlCommit";

export interface TeslaCarCardProps {
  config: EvStatusConfig;
}

export function TeslaCarCard({ config }: TeslaCarCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);

  const battery = parseNumericState(entities[config.evBattery]?.state);
  const range = parseNumericState(entities[config.evRange]?.state);
  const rangeUnit = entities[config.evRange]?.attributes?.unit_of_measurement as string | undefined;

  const isCharging = entities[config.evCharging]?.state === "on";
  const cableConnected = entities[config.evCharger]?.state === "on";
  const isScheduled = entities[config.evScheduledCharging]?.state === "on";

  const chargerPowerE = entities[config.evChargerPower];
  const chargerPowerW = isCharging
    ? (toWatts(chargerPowerE?.state, chargerPowerE?.attributes?.unit_of_measurement as string | undefined) ?? null)
    : null;

  const energyAdded = parseNumericState(entities[config.evEnergyAdded]?.state);
  const timeToFull = entities[config.evTimeToFull]?.state;

  const serverChargeLimit = parseNumericState(entities[config.evChargeLimit]?.state) ?? 80;

  // Charge limit control with debounce
  const onLimitCommit = useCallback(
    (value: number) => {
      if (!connection) return;
      void callService(connection, "number", "set_value", { value }, {
        entity_id: config.evChargeLimit,
      });
    },
    [connection, config.evChargeLimit],
  );

  const limitControl = useControlCommit<number>(serverChargeLimit, onLimitCommit, {
    debounceMs: 800,
  });

  const toggleCharging = useCallback(() => {
    if (!connection) return;
    const service = isCharging ? "turn_off" : "turn_on";
    void callService(connection, "switch", service, {}, {
      entity_id: config.evChargeSwitch,
    });
  }, [connection, isCharging, config.evChargeSwitch]);

  const batteryPct = battery ?? 0;
  const limitPct = limitControl.displayValue;

  const batteryColor =
    batteryPct < 20
      ? "bg-accent-red"
      : batteryPct < 40
        ? "bg-accent-warm"
        : "bg-accent-green";

  const isUnavailable = battery == null;

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:car-electric" width={18} className="text-text-secondary" />
          <h2 className="text-sm font-medium text-text-secondary">{config.carLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          {cableConnected && (
            <span className="flex items-center gap-1 text-xs text-text-dim">
              <Icon icon="mdi:power-plug" width={13} />
              Connected
            </span>
          )}
          {isScheduled && !isCharging && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              <Icon icon="mdi:calendar-clock" width={12} />
              Scheduled
            </span>
          )}
          {isCharging && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-accent-green/15 px-2 py-0.5 text-[11px] font-medium text-accent-green">
              <Icon icon="mdi:lightning-bolt" width={12} />
              Charging
            </span>
          )}
        </div>
      </div>

      {isUnavailable ? (
        <div className="py-4 text-center text-sm text-text-dim">
          Car unavailable (sleeping or out of range)
        </div>
      ) : (
        <>
          {/* Battery bar with charge limit marker */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="tabular-nums font-medium text-text-primary">
                {Math.round(batteryPct)}%
              </span>
              {range !== null && (
                <span className="tabular-nums text-text-dim">
                  {Math.round(range)} {rangeUnit ?? "mi"}
                </span>
              )}
            </div>
            <div className="relative h-3 w-full overflow-visible rounded-full bg-bg-elevated">
              {/* Filled portion */}
              <div
                className={`h-full rounded-full transition-all ${batteryColor}`}
                style={{ width: `${batteryPct}%` }}
              />
              {/* Charge limit marker */}
              {limitPct > 0 && limitPct <= 100 && (
                <div
                  className="absolute top-0 h-full w-0.5 rounded-full bg-text-secondary opacity-60"
                  style={{ left: `${limitPct}%`, transform: "translateX(-50%)" }}
                  title={`Charge limit: ${Math.round(limitPct)}%`}
                />
              )}
            </div>
          </div>

          {/* Charging stats (only when charging) */}
          {isCharging && (
            <div className="mb-3 space-y-1.5">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 rounded-xl bg-bg-elevated px-3 py-2 text-sm">
                {chargerPowerW !== null && chargerPowerW > 0 && (
                  <span className="tabular-nums">
                    <span className="text-text-dim">Power </span>
                    <span className="font-medium text-accent-green">
                      {formatPower(chargerPowerW)}
                    </span>
                  </span>
                )}
                {energyAdded !== null && energyAdded > 0 && (
                  <span className="tabular-nums">
                    <span className="text-text-dim">Added </span>
                    <span className="font-medium">+{energyAdded.toFixed(1)} kWh</span>
                  </span>
                )}
                {timeToFull &&
                  timeToFull !== "unknown" &&
                  timeToFull !== "unavailable" && (
                    <span className="tabular-nums">
                      <span className="text-text-dim">Full at </span>
                      <span className="font-medium">
                        {new Date(timeToFull).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* Controls row */}
          {cableConnected && (
            <div className="flex items-center justify-between gap-3">
              {/* Charge limit adjuster */}
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-text-dim">Limit</span>
                <button
                  onClick={() => limitControl.set(Math.max(50, limitControl.displayValue - 5))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary"
                  aria-label="Decrease charge limit"
                >
                  <Icon icon="mdi:minus" width={14} />
                </button>
                <span className="min-w-8 text-center text-sm tabular-nums font-medium">
                  {Math.round(limitControl.displayValue)}%
                </span>
                <button
                  onClick={() => limitControl.set(Math.min(100, limitControl.displayValue + 5))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary hover:text-text-primary"
                  aria-label="Increase charge limit"
                >
                  <Icon icon="mdi:plus" width={14} />
                </button>
              </div>

              {/* Toggle charging */}
              <button
                onClick={toggleCharging}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                  isCharging
                    ? "bg-accent-green/20 text-accent-green hover:bg-accent-green/30"
                    : "bg-bg-elevated text-text-secondary hover:bg-bg-elevated/80"
                }`}
              >
                <Icon
                  icon={isCharging ? "mdi:pause" : "mdi:play"}
                  width={15}
                />
                {isCharging ? "Stop" : "Start"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
