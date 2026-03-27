import { useHass, useUser } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { useMemo } from "react";
import { NAV_ITEMS, type NavItem } from "../lib/navigation";
import { CLIMATE_MODE, SOLAR_POWER } from "../lib/entities";
import { toWatts } from "../lib/format";

/**
 * Filters navigation items based on visibility rules and swaps icons
 * for climate (summer ↔ winter) and energy (solar producing ↔ grid).
 */
export function useNavVisibility(): NavItem[] {
  const entities = useHass((s) => s.entities) as HassEntities;
  const user = useUser();

  return useMemo(() => {
    const climateMode = entities[CLIMATE_MODE]?.state;
    const isWinter =
      climateMode === "Winter" || climateMode === "Winter-Eco";
    const isSummer = climateMode === "Summer";

    const isAdmin =
      user?.is_admin ?? false;

    const solarE = entities[SOLAR_POWER];
    const solarW = toWatts(solarE?.state, solarE?.attributes?.unit_of_measurement as string) ?? 0;
    const hasSolar = solarW > 50;

    return NAV_ITEMS
      .filter((item) => {
        if (item.visible === "seasonal" && isWinter) return false;
        if (item.visible === "admin" && !isAdmin) return false;
        return true;
      })
      .map((item) => {
        if (item.id === "climate" && isSummer)
          return { ...item, icon: "lucide:thermometer-snowflake" };
        if (item.id === "energy" && !hasSolar)
          return { ...item, icon: "mdi:transmission-tower" };
        return item;
      });
  }, [entities, user]);
}
