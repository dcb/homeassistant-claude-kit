import type { HistoryPoint } from "../hooks/useHistory";
import type { SolarTotals } from "../components/charts/SolarChartLegend";

export interface ChartRow {
  time: number;
  solar: number | null;
  house: number | null;
  charger: number | null;
  chargerTop: number | null;
  forecast: number | null;
}

/**
 * Merge solar, load, charger, and forecast into unified chart rows.
 * House load = total load - charger power.
 * Charger power is shown as a separate stacked area.
 */
export function mergeChartData(
  solar: HistoryPoint[],
  load: HistoryPoint[],
  charger: HistoryPoint[],
  forecast: HistoryPoint[],
  toW: number,
  chargerToW: number,
): ChartRow[] {
  if (solar.length === 0 && load.length === 0 && forecast.length === 0) return [];

  const timeSet = new Set<number>();
  for (const p of solar) timeSet.add(p.time);
  for (const p of load) timeSet.add(p.time);
  for (const p of charger) timeSet.add(p.time);
  for (const p of forecast) timeSet.add(p.time);
  const times = Array.from(timeSet).sort((a, b) => a - b);

  const solarMap = new Map(solar.map((p) => [p.time, p.value * toW]));
  const loadMap = new Map(load.map((p) => [p.time, p.value * toW]));
  const chargerMap = new Map(charger.map((p) => [p.time, p.value * chargerToW]));
  // Linear interpolation for forecast — forecast timestamps differ from
  // actual data timestamps, so we interpolate to avoid null gaps in the line.
  const interpolateForecast = (t: number): number | null => {
    if (forecast.length === 0) return null;
    if (t <= forecast[0].time) return forecast[0].value > 0 ? forecast[0].value : null;
    if (t >= forecast[forecast.length - 1].time) {
      return forecast[forecast.length - 1].value > 0 ? forecast[forecast.length - 1].value : null;
    }
    let lo = 0, hi = forecast.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (forecast[mid].time <= t) lo = mid; else hi = mid;
    }
    const p0 = forecast[lo], p1 = forecast[hi];
    const frac = (t - p0.time) / (p1.time - p0.time);
    const val = p0.value + frac * (p1.value - p0.value);
    return val > 0 ? val : null;
  };

  const lastActualTime = Math.max(
    solar.length > 0 ? solar[solar.length - 1].time : 0,
    load.length > 0 ? load[load.length - 1].time : 0,
  );

  // Max time gap for forward-filling — beyond this, treat as a data gap (null).
  const GAP_MS = 10 * 60_000; // 10 minutes

  let lastSolar: number | null = null;
  let lastSolarTime = 0;
  let lastLoad: number | null = null;
  let lastLoadTime = 0;
  let lastCharger: number | null = null;
  let lastChargerTime = 0;

  const rows = times.map((t) => {
    const s = solarMap.get(t);
    const l = loadMap.get(t);
    const c = chargerMap.get(t);
    if (s !== undefined) { lastSolar = s; lastSolarTime = t; }
    if (l !== undefined) { lastLoad = l; lastLoadTime = t; }
    if (c !== undefined) { lastCharger = c; lastChargerTime = t; }
    const pastActual = t > lastActualTime;

    const totalLoad = !pastActual && t - lastLoadTime <= GAP_MS ? lastLoad : null;
    const chargerW = !pastActual && lastCharger !== null && lastCharger > 50 && t - lastChargerTime <= GAP_MS ? lastCharger : 0;
    const houseW = totalLoad !== null ? Math.max(0, totalLoad - chargerW) : null;

    // chargerTop = house + charger (absolute Y for the line overlay)
    const chargerTop = houseW !== null && chargerW > 0 ? houseW + chargerW : null;

    return {
      time: t,
      solar: !pastActual && lastSolar !== null && lastSolar > 10 && t - lastSolarTime <= GAP_MS ? lastSolar : null,
      house: houseW,
      charger: houseW !== null && chargerW > 0 ? chargerW : null,
      chargerTop,
      forecast: interpolateForecast(t),
    };
  });

  return rows;
}

/**
 * Compute energy totals including charger solar/grid split.
 *
 * Solar/grid split assumption: the car uses whatever is left from solar
 * after the house consumption is fully covered by solar.
 *   house_only = load - charger_power
 *   solar_to_house = min(solar, house_only)
 *   remaining_solar = solar - solar_to_house
 *   solar_to_charger = min(remaining_solar, charger_power)
 *   grid_to_charger = charger_power - solar_to_charger
 */
export function computeTotals(
  solar: HistoryPoint[],
  load: HistoryPoint[],
  grid: HistoryPoint[],
  charger: HistoryPoint[],
  toW: number,
  chargerToW: number,
  gridPrice: number | null,
  exportPrice: number | null,
): SolarTotals {
  const integrate = (points: HistoryPoint[], multiplier = 1): number => {
    if (points.length < 2) return 0;
    let wh = 0;
    for (let i = 1; i < points.length; i++) {
      const dtHours = (points[i].time - points[i - 1].time) / 3_600_000;
      const avgW = ((points[i].value + points[i - 1].value) / 2) * multiplier;
      wh += avgW * dtHours;
    }
    return wh / 1000;
  };

  // Grid: positive = export, negative = import
  let importedKwh = 0;
  let exportedKwh = 0;
  if (grid.length >= 2) {
    for (let i = 1; i < grid.length; i++) {
      const dtHours = (grid[i].time - grid[i - 1].time) / 3_600_000;
      const avgW = (grid[i].value + grid[i - 1].value) / 2;
      if (avgW > 0) {
        exportedKwh += (avgW * dtHours) / 1000;
      } else {
        importedKwh += (Math.abs(avgW) * dtHours) / 1000;
      }
    }
  }

  // Net cost
  let netCost: number | null = null;
  if (gridPrice !== null && exportPrice !== null && grid.length >= 2) {
    const cost = importedKwh * gridPrice;
    const revenue = exportedKwh * exportPrice;
    netCost = Math.round((cost - revenue) * 100) / 100;
  }

  // Peak solar
  let peakSolar = 0;
  for (const p of solar) {
    const w = p.value * toW;
    if (w > peakSolar) peakSolar = w;
  }

  // Charger solar/grid split via time-aligned interpolation
  let chargerSolarWh = 0;
  let chargerGridWh = 0;

  if (charger.length >= 2 && solar.length >= 2 && load.length >= 2) {
    const interpolate = (points: HistoryPoint[], t: number, mult: number): number => {
      if (points.length === 0) return 0;
      if (t <= points[0].time) return points[0].value * mult;
      if (t >= points[points.length - 1].time) return points[points.length - 1].value * mult;
      let lo = 0;
      let hi = points.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (points[mid].time <= t) lo = mid;
        else hi = mid;
      }
      const p0 = points[lo];
      const p1 = points[hi];
      const frac = (t - p0.time) / (p1.time - p0.time);
      return (p0.value + frac * (p1.value - p0.value)) * mult;
    };

    for (let i = 1; i < charger.length; i++) {
      const t0 = charger[i - 1].time;
      const t1 = charger[i].time;
      const tMid = (t0 + t1) / 2;
      const dtHours = (t1 - t0) / 3_600_000;

      const chargerW = ((charger[i - 1].value + charger[i].value) / 2) * chargerToW;
      if (chargerW < 50) continue;

      const solarW = interpolate(solar, tMid, toW);
      const loadW = interpolate(load, tMid, toW);
      const houseW = Math.max(0, loadW - chargerW);

      const solarToHouse = Math.min(solarW, houseW);
      const remainingSolar = Math.max(0, solarW - solarToHouse);
      const solarToCharger = Math.min(remainingSolar, chargerW);
      const gridToCharger = chargerW - solarToCharger;

      chargerSolarWh += solarToCharger * dtHours;
      chargerGridWh += gridToCharger * dtHours;
    }
  }

  const chargerSolar = chargerSolarWh / 1000;
  const chargerGrid = chargerGridWh / 1000;
  const chargerGridCost = gridPrice !== null ? chargerGrid * gridPrice : 0;
  const chargerSolarSaved = gridPrice !== null ? chargerSolar * gridPrice : 0;

  return {
    produced: integrate(solar, toW),
    consumed: integrate(load, toW),
    netCost,
    peakSolar,
    chargerSolar,
    chargerGrid,
    chargerGridCost,
    chargerSolarSaved,
  };
}
