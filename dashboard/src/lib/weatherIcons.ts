/**
 * Map Home Assistant weather conditions to Meteocons animated icon names.
 * Day/night variants are selected based on HA's time_of_day sensor.
 */

type IconVariants = { day: string; night: string };

const CONDITION_MAP: Record<string, IconVariants> = {
  "clear-night": { day: "meteocons:clear-day", night: "meteocons:clear-night" },
  cloudy: { day: "meteocons:overcast", night: "meteocons:overcast" },
  fog: { day: "meteocons:fog-day", night: "meteocons:fog-night" },
  hail: { day: "meteocons:hail", night: "meteocons:hail" },
  lightning: {
    day: "meteocons:thunderstorms-day",
    night: "meteocons:thunderstorms-night",
  },
  "lightning-rainy": {
    day: "meteocons:thunderstorms-day-rain",
    night: "meteocons:thunderstorms-night-rain",
  },
  partlycloudy: {
    day: "meteocons:partly-cloudy-day",
    night: "meteocons:partly-cloudy-night",
  },
  pouring: {
    day: "meteocons:extreme-rain",
    night: "meteocons:extreme-rain",
  },
  rainy: { day: "meteocons:rain", night: "meteocons:rain" },
  snowy: { day: "meteocons:snow", night: "meteocons:snow" },
  "snowy-rainy": { day: "meteocons:sleet", night: "meteocons:sleet" },
  sunny: { day: "meteocons:clear-day", night: "meteocons:clear-night" },
  windy: { day: "meteocons:wind", night: "meteocons:wind" },
  "windy-variant": { day: "meteocons:wind", night: "meteocons:wind" },
  exceptional: {
    day: "meteocons:not-available",
    night: "meteocons:not-available",
  },
};

/**
 * Get a Meteocons icon name for a HA weather condition.
 * @param condition - HA weather condition string (e.g. "sunny", "rainy")
 * @param isNight - whether it's currently night time
 */
export function weatherIcon(condition: string, isNight: boolean): string {
  const entry = CONDITION_MAP[condition];
  if (!entry) return "meteocons:not-available";
  return isNight ? entry.night : entry.day;
}

/** Pretty-print a HA weather condition. */
export function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    "clear-night": "Clear",
    cloudy: "Cloudy",
    fog: "Fog",
    hail: "Hail",
    lightning: "Thunder",
    "lightning-rainy": "Thunderstorm",
    partlycloudy: "Partly Cloudy",
    pouring: "Heavy Rain",
    rainy: "Rain",
    snowy: "Snow",
    "snowy-rainy": "Sleet",
    sunny: "Sunny",
    windy: "Windy",
    "windy-variant": "Windy",
    exceptional: "Exceptional",
  };
  return labels[condition] ?? condition;
}
