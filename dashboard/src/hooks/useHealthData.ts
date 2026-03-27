import { useMemo, useEffect, useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities, Connection } from "home-assistant-js-websocket";
import { parseNumericState } from "../lib/format";
import {
  SYSTEM_CPU,
  SYSTEM_RAM,
  SYSTEM_DISK,
  SYSTEM_LAST_BOOT,
} from "../lib/entities";
import {
  EXCLUDED_BATTERY_PLATFORMS,
  MONITORED_INTEGRATIONS,
  STALE_SENSORS,
  HEALTH_AUTOMATIONS,
  STALE_THRESHOLD_MS,
} from "../views/health-constants";
import type { BatteryInfo } from "../views/health-constants";

/** Fetch entity registry and build entity_id → platform map */
function useEntityPlatforms(): Map<string, string> {
  const connection = useHass((s) => s.connection) as Connection | null;
  const [platforms, setPlatforms] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!connection) return;
    connection
      .sendMessagePromise<{ entity_id: string; platform: string }[]>({
        type: "config/entity_registry/list",
      })
      .then((entries) => {
        const map = new Map<string, string>();
        for (const entry of entries) {
          map.set(entry.entity_id, entry.platform);
        }
        setPlatforms(map);
      })
      .catch(() => {});
  }, [connection]);

  return platforms;
}

export interface HealthData {
  cpu: string | undefined;
  ram: string | undefined;
  disk: string | undefined;
  batteries: BatteryInfo[];
  criticalBatteries: BatteryInfo[];
  staleSensors: { name: string; hoursAgo: number }[];
  healthEvents: { label: string; triggered: Date; state: string }[];
  uptimeText: { uptime: string; bootStr: string } | null;
  healthyCount: number;
  entities: HassEntities;
}

export function useHealthData(): HealthData {
  const entities = useHass((s) => s.entities) as HassEntities;
  const platformMap = useEntityPlatforms();

  const cpu = entities[SYSTEM_CPU]?.state;
  const ram = entities[SYSTEM_RAM]?.state;
  const disk = entities[SYSTEM_DISK]?.state;
  const lastBoot = entities[SYSTEM_LAST_BOOT]?.state;

  // Discover all battery sensors, filtered by platform
  const batteries = useMemo(() => {
    const result: BatteryInfo[] = [];
    for (const [id, entity] of Object.entries(entities)) {
      if (
        entity.attributes?.device_class === "battery" &&
        id.startsWith("sensor.")
      ) {
        const platform = platformMap.get(id);
        if (platform && EXCLUDED_BATTERY_PLATFORMS.has(platform)) continue;

        const level = parseNumericState(entity.state);
        if (level !== null && level >= 0 && level <= 100) {
          result.push({
            name: entity.attributes.friendly_name ?? id.replace("sensor.", ""),
            level,
            entityId: id,
          });
        }
      }
    }
    result.sort((a, b) => a.level - b.level);
    return result;
  }, [entities, platformMap]);

  const criticalBatteries = batteries.filter((b) => b.level < 20);

  // Check stale sensors
  const staleSensors = useMemo(() => {
    const now = Date.now();
    const stale: { name: string; hoursAgo: number }[] = [];
    for (const sensorId of STALE_SENSORS) {
      const entity = entities[sensorId];
      if (!entity || entity.state === "unavailable" || entity.state === "unknown") continue;
      const lastUpdated = new Date(entity.last_updated).getTime();
      const elapsed = now - lastUpdated;
      if (elapsed > STALE_THRESHOLD_MS) {
        stale.push({
          name: entity.attributes?.friendly_name ?? sensorId,
          hoursAgo: Math.round((elapsed / 3600000) * 10) / 10,
        });
      }
    }
    return stale;
  }, [entities]);

  // Health automation events (last_triggered)
  const healthEvents = useMemo(() => {
    const events: { label: string; triggered: Date; state: string }[] = [];
    for (const auto of HEALTH_AUTOMATIONS) {
      const entity = entities[auto.entity];
      if (!entity) continue;
      const lastTriggered = entity.attributes?.last_triggered;
      if (lastTriggered) {
        events.push({
          label: auto.label,
          triggered: new Date(lastTriggered),
          state: entity.state,
        });
      }
    }
    events.sort((a, b) => b.triggered.getTime() - a.triggered.getTime());
    return events;
  }, [entities]);

  // Format uptime
  const uptimeText = useMemo(() => {
    if (!lastBoot) return null;
    const bootTime = new Date(lastBoot);
    if (isNaN(bootTime.getTime())) return null;
    const diffMs = Date.now() - bootTime.getTime();
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const uptime = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    const bootStr = bootTime.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return { uptime, bootStr };
  }, [lastBoot]);

  const healthyCount = MONITORED_INTEGRATIONS.filter((i) => {
    const e = entities[i.entity];
    return e && e.state !== "unavailable" && e.state !== "unknown";
  }).length;

  return {
    cpu,
    ram,
    disk,
    batteries,
    criticalBatteries,
    staleSensors,
    healthEvents,
    uptimeText,
    healthyCount,
    entities,
  };
}
