import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { HeaderConfig } from "../../lib/entities";
import { formatTemp } from "../../lib/format";

interface HeaderProps {
  config: HeaderConfig;
}

export function Header({ config }: HeaderProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const climateMode = entities[config.climateMode]?.state ?? "—";
  const outdoorTemp = entities[config.outdoorTemp]?.state;
  const weather = entities[config.weather]?.state;

  return (
    <header className="sticky top-0 z-30 flex min-w-0 items-center gap-2 bg-bg-primary/80 px-4 py-2 text-xs backdrop-blur-md">
      {/* Presence badges */}
      <div className="flex min-w-0 items-center gap-2">
        {config.persons.map((p) => {
          const state = entities[p.id]?.state;
          const isHome = state === "home";
          return (
            <div key={p.id} className="flex items-center gap-1" title={p.name}>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isHome ? "bg-accent-green" : "bg-text-dim"
                }`}
              />
              <span className="truncate text-text-secondary">{p.name}</span>
            </div>
          );
        })}
      </div>

      <div className="min-w-0 flex-1" />

      {/* Weather + mode — truncate if needed */}
      {formatTemp(outdoorTemp) && (
        <span className="truncate text-text-secondary">
          {formatTemp(outdoorTemp)}°C
          {weather ? ` · ${weather}` : ""}
        </span>
      )}

      <span className="flex shrink-0 items-center gap-1 rounded-full bg-bg-elevated px-2 py-0.5 text-text-secondary">
        <Icon
          icon={climateMode === "Summer" ? "lucide:thermometer-snowflake" : "lucide:thermometer-sun"}
          width={12}
        />
        {climateMode}
      </span>
    </header>
  );
}
