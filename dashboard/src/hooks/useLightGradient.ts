import { useMemo } from "react";
import type { HassEntities } from "home-assistant-js-websocket";

/**
 * Build a cache key that changes when any light's visual properties change.
 * This avoids spread deps in useMemo while still reacting to state changes.
 */
function lightCacheKey(lights: string[], entities: HassEntities): string {
  return lights
    .map((id) => {
      const e = entities[id];
      if (!e || e.state !== "on") return "off";
      const b = e.attributes?.brightness ?? 0;
      const k = e.attributes?.color_temp_kelvin ?? "";
      const rgb = e.attributes?.rgb_color;
      return `${b}:${k}:${rgb ? rgb.join(",") : ""}`;
    })
    .join("|");
}

/**
 * Compute a CSS gradient string reflecting the aggregate color and brightness
 * of the given light entities. Returns undefined when no lights are on.
 */
export function useLightGradient(
  lights: string[],
  entities: HassEntities,
): string | undefined {
  const cacheKey = lightCacheKey(lights, entities);

  return useMemo(() => {
    const onLights = lights
      .map((id) => entities[id])
      .filter((e) => e?.state === "on");

    if (onLights.length === 0) return undefined;

    // Average brightness (0–1)
    const avgBrightness =
      onLights.reduce((sum, e) => sum + ((e.attributes?.brightness as number) ?? 128), 0) /
      onLights.length /
      255;

    // Determine gradient color from light attributes
    let r = 255, g = 180, b = 80; // warm default

    // Check if any light has rgb_color
    const rgbLight = onLights.find((e) => e.attributes?.rgb_color);
    if (rgbLight) {
      const [lr, lg, lb] = rgbLight.attributes.rgb_color as [number, number, number];
      r = lr; g = lg; b = lb;
    } else {
      // Derive from color_temp_kelvin
      const temps = onLights
        .map((e) => e.attributes?.color_temp_kelvin as number | undefined)
        .filter((t): t is number => t != null);
      if (temps.length > 0) {
        const avgK = temps.reduce((a, b) => a + b, 0) / temps.length;
        // Map 2000K (warm amber) → 6500K (cool white)
        const t = Math.max(0, Math.min(1, (avgK - 2000) / 4500));
        r = Math.round(255 - t * 60);   // 255 → 195
        g = Math.round(160 + t * 80);   // 160 → 240
        b = Math.round(60 + t * 195);   // 60  → 255
      }
    }

    const alpha = 0.06 + avgBrightness * 0.12; // 0.06 – 0.18
    return `linear-gradient(to top, rgba(${r},${g},${b},${alpha}) 0%, transparent 65%)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);
}
