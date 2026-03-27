import { useRef, useState, useEffect, useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { ContextConfig } from "../../lib/entities";
import { toWatts, formatPower, formatDuration, parseNumericState } from "../../lib/format";
import { weatherIcon, conditionLabel } from "../../lib/weatherIcons";
import { useWeatherForecast, type ForecastEntry } from "../../hooks/useWeatherForecast";
import { useAttributeTimeline } from "../../hooks/useStateHistory";
import { useMinuteTick } from "../../hooks/useMinuteTick";

export function ContextCard({ config }: { config: ContextConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const timeOfDay = entities[config.timeOfDay]?.state ?? "day";

  // Boiler state + session duration
  const boilerActive = entities[config.boilerEntity]?.attributes?.hvac_action === "heating";
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const boilerSpans = useAttributeTimeline(config.boilerEntity, "hvac_action", startOfToday);
  const now = useMinuteTick(boilerActive);
  const boilerSessionMs = useMemo(() => {
    if (!boilerActive || boilerSpans.length === 0) return 0;
    const last = boilerSpans[boilerSpans.length - 1];
    if (last.state !== "heating") return 0;
    return now - last.start;
  }, [boilerActive, boilerSpans, now]);

  // Energy data
  const solarE = entities[config.solarPower];
  const solarW = toWatts(solarE?.state, solarE?.attributes?.unit_of_measurement as string) ?? 0;
  const loadE = entities[config.loadPower];
  const loadW = toWatts(loadE?.state, loadE?.attributes?.unit_of_measurement as string) ?? 0;
  const chargerImportE = entities[config.chargerPower];
  const chargerOfferedE = entities[config.chargerPowerOffered];
  const importW = toWatts(chargerImportE?.state, chargerImportE?.attributes?.unit_of_measurement as string) ?? 0;
  const offeredW = toWatts(chargerOfferedE?.state, chargerOfferedE?.attributes?.unit_of_measurement as string) ?? 0;
  const connectorState = entities[config.chargerStatus]?.state;
  const isOcppCharging = connectorState === "Charging";
  const chargerW = importW > 50 ? importW : (isOcppCharging ? offeredW : 0);
  const isCharging = isOcppCharging && chargerW > 50;

  // EV battery
  const batteryLevel = parseNumericState(entities[config.evBattery]?.state);
  const evChargingState = entities[config.evCharging]?.state;
  const isEvCharging = evChargingState === "charging" || evChargingState === "starting";

  // Weather data
  const isNight = timeOfDay === "night" || timeOfDay === "evening";
  const weatherState = entities[config.weather]?.state ?? "sunny";
  const weatherAttrs = entities[config.weather]?.attributes ?? {};
  const outdoorTemp = parseNumericState(entities[config.outdoorTemp]?.state);
  const humidity = parseNumericState(entities[config.outdoorHumidity]?.state);
  const pressure = parseNumericState(entities[config.indoorPressure]?.state);
  const windSpeed = weatherAttrs.wind_speed as number | undefined;
  const windBearing = weatherAttrs.wind_bearing as number | undefined;
  const forecastLow = parseNumericState(entities[config.forecastLow]?.state);
  const forecastHigh = parseNumericState(entities[config.forecastHigh]?.state);

  const forecast = useWeatherForecast();
  const forecastSlice = forecast.slice(0, 24);

  return (
    <div className="contain-card rounded-2xl bg-bg-card p-5">
      {/* Weather row */}
      <div className="flex items-start justify-between gap-4">
        {/* Left: energy info */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
          {/* Boiler */}
          <span className="flex items-center gap-1">
            <Icon
              icon="ph:fire-duotone"
              width={15}
              className={boilerActive ? "" : "text-text-dim"}
              style={boilerActive ? { animation: "glow-warm 2s ease-in-out infinite" } : undefined}
            />
            {boilerActive && boilerSessionMs > 0 && (
              <span className="tabular-nums">{formatDuration(boilerSessionMs)}</span>
            )}
            {!boilerActive && <span className="text-text-dim">off</span>}
          </span>

          {/* Solar production */}
          {solarW > 50 && (
            <span className="flex items-center gap-1">
              <Icon icon="mdi:solar-power" width={14} className="text-accent-warm" />
              <span className="text-accent-warm">{formatPower(solarW)}</span>
            </span>
          )}

          {/* House load */}
          <span className="flex items-center gap-1">
            <Icon icon="mdi:home-lightning-bolt" width={14} className="text-text-dim" />
            {formatPower(loadW)}
          </span>

          {/* Charger load (only when charging) */}
          {isCharging && (
            <span className="flex items-center gap-1">
              <Icon icon="mdi:ev-station" width={14} className="text-accent-green" />
              <span className="text-accent-green">{formatPower(chargerW)}</span>
            </span>
          )}

          {/* Car battery */}
          {batteryLevel !== null && (
            <span className="flex items-center gap-1">
              <Icon
                icon="bi:ev-front-fill"
                width={14}
                className={isEvCharging ? "text-accent-green" : "text-text-dim"}
                style={isEvCharging ? { animation: "glow-cool 2s ease-in-out infinite" } : undefined}
              />
              <span className={isEvCharging ? "text-accent-green tabular-nums" : "tabular-nums"}>
                {Math.round(batteryLevel)}%
              </span>
            </span>
          )}
        </div>

        {/* Right: weather summary — two columns, top-aligned */}
        <div className="flex shrink-0 items-start gap-2.5">
          <div className="flex flex-col items-end">
            <div className="text-2xl font-light tabular-nums leading-[48px]">
              {outdoorTemp !== null ? `${outdoorTemp.toFixed(1)}°` : "—"}
            </div>
            {(forecastHigh !== null || forecastLow !== null) && (
              <div className="text-[11px] text-text-secondary tabular-nums">
                {forecastHigh !== null && <span>{Math.round(forecastHigh)}°</span>}
                {forecastHigh !== null && forecastLow !== null && <span> / </span>}
                {forecastLow !== null && <span>{Math.round(forecastLow)}°</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <Icon
              icon={weatherIcon(weatherState, isNight)}
              width={48}
            />
            <div className="text-[10px] text-text-secondary">
              {conditionLabel(weatherState)}
            </div>
          </div>
        </div>
      </div>

      {/* Weather stats row */}
      <div className="mt-2 flex items-center justify-end gap-4 text-xs text-text-secondary">
        {humidity !== null && (
          <span className="flex items-center gap-1">
            <Icon icon="meteocons:humidity" width={18} />
            {Math.round(humidity)}%
          </span>
        )}
        {windSpeed != null && (
          <span className="flex items-center gap-1">
            <Icon icon="meteocons:wind" width={18} />
            {Math.round(windSpeed)} km/h
            {windBearing != null && (
              <Icon
                icon="mdi:navigation"
                width={12}
                className="text-text-dim"
                style={{ transform: `rotate(${windBearing}deg)` }}
              />
            )}
          </span>
        )}
        {pressure !== null && (
          <span className="flex items-center gap-1">
            <Icon icon="meteocons:barometer" width={18} />
            {Math.round(pressure)} hPa
          </span>
        )}
      </div>

      {/* Hourly forecast — always visible */}
      {forecastSlice.length > 0 && (
        <HourlyForecast entries={forecastSlice} />
      )}
    </div>
  );
}

function HourlyForecast({ entries }: { entries: ForecastEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [entries.length]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <div className="relative mt-3 -mx-1">
      {/* Left fade + arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-0 bottom-0 z-10 flex w-7 items-center justify-center bg-linear-to-r from-bg-card to-transparent"
        >
          <Icon icon="mdi:chevron-left" width={18} className="text-text-dim" />
        </button>
      )}

      {/* Scrollable forecast strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto px-1 scrollbar-none"
      >
        {entries.map((entry) => {
          const hour = new Date(entry.datetime).getHours();
          const entryIsNight = hour >= 21 || hour < 6;
          return (
            <div
              key={entry.datetime}
              className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-2 text-xs"
            >
              <span className="text-text-dim">
                {hour.toString().padStart(2, "0")}
              </span>
              <Icon
                icon={weatherIcon(entry.condition, entryIsNight)}
                width={28}
              />
              <span className="font-medium tabular-nums">
                {Math.round(entry.temperature)}°
              </span>
              {entry.precipitation_probability > 0 && (
                <span className="text-[10px] text-blue-400 tabular-nums">
                  {Math.round(entry.precipitation_probability)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Right fade + arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-0 bottom-0 z-10 flex w-7 items-center justify-center bg-linear-to-l from-bg-card to-transparent"
        >
          <Icon icon="mdi:chevron-right" width={18} className="text-text-dim" />
        </button>
      )}
    </div>
  );
}

