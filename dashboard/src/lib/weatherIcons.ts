const ICONS: Record<string, { day: string; night: string }> = {
  "clear-night":           { day: "mdi:weather-night",              night: "mdi:weather-night" },
  "cloudy":                { day: "mdi:weather-cloudy",             night: "mdi:weather-cloudy" },
  "exceptional":           { day: "mdi:weather-lightning",          night: "mdi:weather-lightning" },
  "fog":                   { day: "mdi:weather-fog",                night: "mdi:weather-fog" },
  "hail":                  { day: "mdi:weather-hail",               night: "mdi:weather-hail" },
  "lightning":             { day: "mdi:weather-lightning",          night: "mdi:weather-lightning" },
  "lightning-rainy":       { day: "mdi:weather-lightning-rainy",    night: "mdi:weather-lightning-rainy" },
  "partlycloudy":          { day: "mdi:weather-partly-cloudy",      night: "mdi:weather-night-partly-cloudy" },
  "pouring":               { day: "mdi:weather-pouring",            night: "mdi:weather-pouring" },
  "rainy":                 { day: "mdi:weather-rainy",              night: "mdi:weather-rainy" },
  "snowy":                 { day: "mdi:weather-snowy",              night: "mdi:weather-snowy" },
  "snowy-rainy":           { day: "mdi:weather-snowy-rainy",        night: "mdi:weather-snowy-rainy" },
  "sunny":                 { day: "mdi:weather-sunny",              night: "mdi:weather-night" },
  "windy":                 { day: "mdi:weather-windy",              night: "mdi:weather-windy" },
  "windy-variant":         { day: "mdi:weather-windy-variant",      night: "mdi:weather-windy-variant" },
};

const LABELS: Record<string, string> = {
  "clear-night": "Clear", "cloudy": "Cloudy", "exceptional": "Stormy",
  "fog": "Foggy", "hail": "Hail", "lightning": "Lightning",
  "lightning-rainy": "Thunderstorm", "partlycloudy": "Partly Cloudy",
  "pouring": "Heavy Rain", "rainy": "Rainy", "snowy": "Snowy",
  "snowy-rainy": "Sleet", "sunny": "Sunny", "windy": "Windy",
  "windy-variant": "Windy",
};

export function weatherIcon(state: string, timeOfDay: "day" | "night" | "evening" | boolean = "day"): string {
  const entry = ICONS[state];
  if (!entry) return "mdi:weather-partly-cloudy";
  const isNight = timeOfDay === "night" || timeOfDay === "evening" || timeOfDay === true;
  return isNight ? entry.night : entry.day;
}

export function conditionLabel(state: string): string {
  return LABELS[state] ?? state.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
