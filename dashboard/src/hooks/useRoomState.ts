import type { HassEntities } from "home-assistant-js-websocket";
import type { RoomConfig } from "../lib/areas";
import { formatTemp, parseNumericState } from "../lib/format";
import { lightColor } from "../components/controls/LightControl";
import { DISHWASHER_STATUS, DISHWASHER_TIME_REMAINING } from "../lib/entities";

interface ContactSensorState {
  entity: string;
  label: string;
  type?: "door" | "window";
}

export interface RoomState {
  // Temperature & environment
  temp: string | null;
  humidity: number | null;
  co2: number | null;
  lux: number | null;
  noise: number | null;
  pressure: number | null;
  aqi: number | null;
  tempRate: number | null;
  targetTemp: number | null;

  // Lights
  lightsOn: number;
  totalLights: number;
  lightsIconColor: string | undefined;

  // Occupancy
  isOccupied: boolean;
  /** Whether the occupancy sensor is available (not unavailable/unknown) */
  occupancyAvailable: boolean;
  /** Zone-level occupancy labels (e.g. ["Desk", "Couch"]) — empty if no zones or none active */
  zoneOccupancy: string[];

  // Covers
  coversOpen: number;
  totalCovers: number;
  /** Per-cover positions: entity ID → position (0-100) or null if binary */
  coverPositions: Record<string, number | null>;

  // Contacts
  openContacts: ContactSensorState[];
  /** All contact sensors with current state (not just open ones) */
  allContacts: { entity: string; label: string; type?: "door" | "window"; isOpen: boolean }[];

  // Climate
  heatingTrvCount: number;
  acAction: string | undefined;

  // Media
  activeMedia: string | undefined;
  mediaEntity: HassEntities[string] | null;
  mediaAppName: string | undefined;
  isMuted: boolean | undefined;

  // Dishwasher (kitchen only)
  dishwasherStatus: string | undefined;
  dishwasherRemaining: string | undefined;
}

export function useRoomState(room: RoomConfig, entities: HassEntities): RoomState {
  // Temperature
  const tempEntity = room.temperatureSensor
    ? entities[room.temperatureSensor]
    : undefined;
  const temp = formatTemp(tempEntity?.state);

  // Humidity
  const humidity = room.humiditySensor
    ? parseNumericState(entities[room.humiditySensor]?.state)
    : null;

  // CO2
  const co2 = room.co2Sensor
    ? parseNumericState(entities[room.co2Sensor]?.state)
    : null;

  // Illuminance (lux)
  const lux = room.illuminanceSensor
    ? parseNumericState(entities[room.illuminanceSensor]?.state)
    : null;

  // Noise (dB)
  const noise = room.noiseSensor
    ? parseNumericState(entities[room.noiseSensor]?.state)
    : null;

  // Atmospheric pressure (hPa)
  const pressure = room.pressureSensor
    ? parseNumericState(entities[room.pressureSensor]?.state)
    : null;

  // Air quality index
  const aqi = room.aqiSensor
    ? parseNumericState(entities[room.aqiSensor]?.state)
    : null;

  // Temperature rate of change (°C/hr)
  const tempRate = room.temperatureRate
    ? parseNumericState(entities[room.temperatureRate]?.state)
    : null;

  // Lights (works for both light.* and switch.* entities)
  const onLightEntities = room.lights
    .map((id) => entities[id])
    .filter((e) => e?.state === "on");
  const lightsOn = onLightEntities.length;
  const totalLights = room.lights.length;

  // Dominant light color for the icon (first on-light with color info)
  const firstOn = onLightEntities[0];
  const lightsIconColor = lightColor(
    lightsOn > 0,
    firstOn?.attributes?.rgb_color as [number, number, number] | undefined,
    firstOn?.attributes?.color_temp_kelvin as number | undefined,
  );

  // Occupancy
  const occState = room.occupancySensor ? entities[room.occupancySensor]?.state : undefined;
  const occupancyAvailable = !!occState && occState !== "unavailable" && occState !== "unknown";
  const isOccupied = occState === "on";

  // Zone-level occupancy (e.g. desk, couch)
  const zoneOccupancy = room.zoneOccupancy
    ?.filter((z) => entities[z.entity]?.state === "on")
    .map((z) => z.label) ?? [];

  // Covers — count open blinds
  const coversOpen = room.covers?.filter(
    (id) => entities[id]?.state === "open",
  ).length ?? 0;
  const totalCovers = room.covers?.length ?? 0;

  // Cover positions
  const coverPositions: Record<string, number | null> = {};
  room.covers?.forEach((id) => {
    const pos = entities[id]?.attributes?.current_position as number | undefined;
    coverPositions[id] = pos ?? null;
  });

  // Contact sensors — find any open ones
  const openContacts = room.contactSensors?.filter(
    (s) => entities[s.entity]?.state === "on",
  ) ?? [];

  // All contact sensors with state (skip unavailable)
  const allContacts = room.contactSensors
    ?.filter((s) => {
      const st = entities[s.entity]?.state;
      return st && st !== "unavailable" && st !== "unknown";
    })
    .map((s) => ({
      ...s,
      isOpen: entities[s.entity]?.state === "on",
    })) ?? [];

  // Climate: split TRVs from ACs
  const trvs = room.climate?.filter((id) => id.includes("radiator")) ?? [];
  const acs = room.climate?.filter((id) => !id.includes("radiator")) ?? [];

  // Count heating TRVs — automation sets state to "heat" when room needs heating
  const heatingTrvCount = trvs.filter((id) => entities[id]?.state === "heat").length;

  // Active AC — prefer hvac_action, fall back to state
  const activeAcEntity = acs
    .map((id) => entities[id])
    .find((e) => {
      if (!e) return false;
      const action = e.attributes?.hvac_action;
      if (action && action !== "idle" && action !== "off") return true;
      // Fallback: AC state itself indicates mode (heat/cool/dry/fan_only/auto)
      return e.state !== "off" && e.state !== "unavailable";
    });
  const acAction = (() => {
    if (!activeAcEntity) return undefined;
    const action = activeAcEntity.attributes?.hvac_action as string | undefined;
    if (action && action !== "idle" && action !== "off") return action;
    // Map state to action-like value for icon color
    const s = activeAcEntity.state;
    if (s === "heat") return "heating";
    if (s === "cool" || s === "dry") return "cooling";
    return s; // fan_only, auto
  })();

  // Target temperature from effective target sensor
  const targetTemp = room.effectiveTarget
    ? parseNumericState(entities[room.effectiveTarget]?.state)
    : null;

  // Media — show playing, or on with app_name
  const activeMedia = room.mediaPlayers?.find(
    (id) => entities[id]?.state === "playing",
  );
  const mediaEntity = activeMedia ? entities[activeMedia] : null;
  const mediaAppName = !mediaEntity
    ? room.mediaPlayers
        ?.map((id) => entities[id])
        .find((e) => e && e.state !== "off" && e.state !== "unavailable" && e.attributes?.app_name)
        ?.attributes?.app_name as string | undefined
    : undefined;
  const isMuted = mediaEntity?.attributes?.is_volume_muted as boolean | undefined;

  // Dishwasher — only relevant for kitchen
  const dishwasherStatus = room.id === "kitchen"
    ? entities[DISHWASHER_STATUS]?.state
    : undefined;
  const dishwasherRemaining = room.id === "kitchen"
    ? entities[DISHWASHER_TIME_REMAINING]?.state
    : undefined;

  return {
    temp,
    humidity,
    co2,
    lux,
    noise,
    pressure,
    aqi,
    tempRate,
    targetTemp,
    lightsOn,
    totalLights,
    lightsIconColor,
    isOccupied,
    occupancyAvailable,
    zoneOccupancy,
    coversOpen,
    totalCovers,
    coverPositions,
    openContacts,
    allContacts,
    heatingTrvCount,
    acAction,
    activeMedia,
    mediaEntity,
    mediaAppName,
    isMuted,
    dishwasherStatus,
    dishwasherRemaining,
  };
}
