import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { toWatts, formatPower } from "../../lib/format";
import type { ActiveAutomationsConfig } from "../../lib/entities";

interface ActiveAutomationsProps {
  config: ActiveAutomationsConfig;
}

/**
 * Shows currently active modes/scenes as a compact strip.
 * Later phases will add WebSocket subscription to automation_triggered events.
 */
export function ActiveAutomations({ config }: ActiveAutomationsProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const activeItems: { label: string; icon: string; color: string }[] = [];

  // Check active modes
  if (entities[config.nightMode]?.state === "on") {
    activeItems.push({ label: "Night mode active", icon: "mdi:weather-night", color: "text-indigo-400" });
  }
  if (entities[config.movieMode]?.state === "on") {
    activeItems.push({ label: "Movie mode active", icon: "mdi:movie-open", color: "text-purple-400" });
  }
  if (entities[config.workMode]?.state === "on") {
    activeItems.push({ label: "Work mode active", icon: "mdi:desk", color: "text-blue-400" });
  }
  if (entities[config.awayMode]?.state === "on") {
    activeItems.push({ label: "Away mode — house unoccupied", icon: "mdi:home-export-outline", color: "text-orange-400" });
  }

  // Check AC heating from solar
  const acGround = entities[config.lrAc];
  const acBedroom = entities[config.brAc];
  const acHeating =
    (acGround?.attributes?.hvac_action === "heating") ||
    (acBedroom?.attributes?.hvac_action === "heating");
  if (acHeating) {
    const spareE = entities[config.sparePower];
    const spareW = toWatts(spareE?.state, spareE?.attributes?.unit_of_measurement as string);
    const label = spareW !== null
      ? `AC heating from solar (${formatPower(spareW)} spare)`
      : "AC heating active";
    activeItems.push({ label, icon: "mdi:solar-power", color: "text-accent-warm" });
  }

  // Check EV charging (OCPP primary, Tesla supplementary)
  const connectorState = entities[config.chargerStatus]?.state;
  const evChargingState = entities[config.evCharging]?.state;
  const evCharging = connectorState === "Charging"
    || evChargingState === "charging"
    || evChargingState === "starting";
  if (evCharging) {
    const importE = entities[config.chargerPower];
    const offeredE = entities[config.chargerPowerOffered];
    const importW = toWatts(importE?.state, importE?.attributes?.unit_of_measurement as string) ?? 0;
    const offeredW = toWatts(offeredE?.state, offeredE?.attributes?.unit_of_measurement as string) ?? 0;
    const powerW = importW > 50 ? importW : (connectorState === "Charging" ? offeredW : null);
    const label = powerW !== null && powerW > 50
      ? `EV charging (${formatPower(powerW)})`
      : "EV charging";
    activeItems.push({ label, icon: "mdi:car-electric", color: "text-accent-green" });
  }

  if (activeItems.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeItems.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-xl bg-bg-card px-4 py-2.5"
        >
          <Icon icon={item.icon} width={18} className={item.color} />
          <span className="text-sm text-text-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
