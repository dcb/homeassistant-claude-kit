import { useEffect, useState } from "react";
import { useHass } from "@hakit/core";
import { WEATHER } from "../lib/entities";

export interface ForecastEntry {
  datetime: string;
  condition: string;
  temperature: number;
  precipitation: number;
  precipitation_probability: number;
  wind_speed: number;
  wind_bearing: number;
}

/**
 * Subscribe to hourly weather forecast from Home Assistant.
 * Uses the `weather/subscribe_forecast` websocket API (HA 2023.12+).
 */
export function useWeatherForecast(): ForecastEntry[] {
  const connection = useHass((s) => s.connection);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);

  useEffect(() => {
    if (!connection) return;

    let stale = false;
    let unsub: (() => void) | undefined;

    connection
      .subscribeMessage<{ type: string; forecast: ForecastEntry[] | null }>(
        (msg) => {
          if (!stale && msg.forecast) {
            setForecast(msg.forecast);
          }
        },
        {
          type: "weather/subscribe_forecast",
          forecast_type: "hourly",
          entity_id: WEATHER,
        },
      )
      .then((u) => {
        if (stale) u(); // connection changed before promise resolved — clean up
        else unsub = u;
      })
      .catch(() => { if (!stale) setForecast([]); });

    return () => {
      stale = true;
      unsub?.();
    };
  }, [connection]);

  return forecast;
}
