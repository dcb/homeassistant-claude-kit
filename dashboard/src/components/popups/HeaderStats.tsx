import { Icon } from "@iconify/react";
import type { RoomState } from "../../hooks/useRoomState";
import type { RoomConfig } from "../../lib/areas";

interface ClimateClusterProps {
  state: RoomState;
}

/** Row 1 right side: heating/AC icon · humidity · temp→target */
export function ClimateCluster({ state }: ClimateClusterProps) {
  const { temp, targetTemp, humidity, heatingTrvCount, acAction, tempRate } = state;
  if (!temp) return null;

  const items: { key: string; node: React.ReactNode }[] = [];

  // Heating TRVs
  if (heatingTrvCount > 0) {
    items.push({
      key: "heat",
      node: (
        <span className="flex items-center gap-0.5" style={{ animation: "glow-warm 2s ease-in-out infinite" }}>
          <Icon icon="lucide:heater" width={14} />
          <span className="tabular-nums">{heatingTrvCount}</span>
        </span>
      ),
    });
  }

  // AC action
  if (acAction) {
    items.push({
      key: "ac",
      node: (
        <span
          className="flex items-center"
          style={{ animation: `${acAction === "cooling" ? "glow-cool" : "glow-warm"} 2s ease-in-out infinite` }}
        >
          <Icon icon="mynaui:air-vent-solid" width={14} />
        </span>
      ),
    });
  }

  // Humidity
  if (humidity !== null) {
    items.push({
      key: "humidity",
      node: (
        <span className="flex items-center gap-0.5 text-text-dim">
          <Icon icon="mdi:water-percent" width={12} />
          <span className="tabular-nums">{Math.round(humidity)}</span>
        </span>
      ),
    });
  }

  // Temperature with rate arrow and target
  const rateArrow = tempRate !== null && Math.abs(tempRate) > 0.2
    ? tempRate > 0 ? "↑" : "↓"
    : "";

  items.push({
    key: "temp",
    node: (
      <span className="flex items-baseline gap-0.5">
        <span className="text-base font-semibold tabular-nums text-text-primary">{temp}°{rateArrow}</span>
        {targetTemp !== null && (
          <span className="text-xs text-text-dim tabular-nums">→{Math.round(targetTemp)}°</span>
        )}
      </span>
    ),
  });

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-dim/30 text-[9px]">·</span>}
          {item.node}
        </span>
      ))}
    </div>
  );
}

interface SensorBarProps {
  room: RoomConfig;
  state: RoomState;
}

/** Row 2: CO₂, lux, noise, pressure, AQI, occupancy, contacts, covers */
export function SensorBar({ room, state }: SensorBarProps) {
  const items: { key: string; node: React.ReactNode }[] = [];

  // CO₂
  if (state.co2 !== null) {
    items.push({
      key: "co2",
      node: (
        <span className={`flex items-center gap-1 ${state.co2 > 1000 ? "text-accent-warm" : ""}`}>
          <Icon icon="mdi:molecule-co2" width={14} />
          <span className="tabular-nums">{Math.round(state.co2)}</span>
        </span>
      ),
    });
  }

  // Illuminance
  if (state.lux !== null) {
    items.push({
      key: "lux",
      node: (
        <span className="flex items-center gap-1">
          <Icon icon="mdi:brightness-5" width={13} />
          <span className="tabular-nums">{Math.round(state.lux)}</span>
        </span>
      ),
    });
  }

  // Noise
  if (state.noise !== null) {
    items.push({
      key: "noise",
      node: (
        <span className="flex items-center gap-1">
          <Icon icon="mdi:volume-vibrate" width={13} />
          <span className="tabular-nums">{Math.round(state.noise)}</span>
        </span>
      ),
    });
  }

  // Pressure
  if (state.pressure !== null) {
    items.push({
      key: "pressure",
      node: (
        <span className="flex items-center gap-1">
          <Icon icon="mdi:gauge" width={13} />
          <span className="tabular-nums">{Math.round(state.pressure)}</span>
        </span>
      ),
    });
  }

  // AQI
  if (state.aqi !== null) {
    items.push({
      key: "aqi",
      node: (
        <span className={`flex items-center gap-1 ${state.aqi > 100 ? "text-accent-warm" : ""}`}>
          <Icon icon="mdi:leaf" width={13} />
          <span className="tabular-nums">{Math.round(state.aqi)}</span>
        </span>
      ),
    });
  }

  // Occupancy — zone-level or generic (skip if sensor unavailable)
  if (room.occupancySensor && state.occupancyAvailable) {
    if (state.zoneOccupancy.length > 0) {
      items.push({
        key: "occupancy",
        node: (
          <span className="flex items-center gap-1 text-accent-green">
            <Icon icon="mdi:motion-sensor" width={13} />
            {state.zoneOccupancy.join(" + ")}
          </span>
        ),
      });
    } else {
      items.push({
        key: "occupancy",
        node: (
          <span className={`flex items-center gap-1 ${state.isOccupied ? "text-accent-green" : "text-text-dim"}`}>
            <Icon icon={state.isOccupied ? "mdi:motion-sensor" : "mdi:motion-sensor-off"} width={13} />
            {state.isOccupied ? "Occupied" : "Vacant"}
          </span>
        ),
      });
    }
  }

  // Contact sensors — all, with open/closed icons
  state.allContacts.forEach((s) => {
    const isDoor = s.type === "door";
    items.push({
      key: s.entity,
      node: (
        <span className={`flex items-center gap-1 ${s.isOpen ? "text-accent-warm" : "text-text-dim"}`}>
          <Icon
            icon={isDoor
              ? (s.isOpen ? "mdi:door-open" : "mdi:door-closed")
              : (s.isOpen ? "mdi:window-open-variant" : "mdi:window-closed-variant")}
            width={13}
          />
          {s.label}
        </span>
      ),
    });
  });

  // Covers — position or open/closed
  if (state.totalCovers > 0) {
    const anyOpen = state.coversOpen > 0;
    const positions = Object.values(state.coverPositions);
    const partialPos = positions.find((p) => p !== null && p > 0 && p < 100);

    items.push({
      key: "covers",
      node: (
        <span className={`flex items-center gap-1 ${anyOpen ? "" : "text-text-dim"}`}>
          <Icon icon={anyOpen ? "mdi:blinds-open" : "mdi:blinds"} width={13} />
          {partialPos !== undefined ? `${partialPos}%` : anyOpen ? "Open" : "Closed"}
        </span>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-dim/30 text-[9px]">·</span>}
          {item.node}
        </span>
      ))}
    </div>
  );
}
