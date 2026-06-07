/**
 * Room configuration for the Home View.
 *
 * About Hue light entities — there are 3 types:
 * - Physical bulbs (e.g. light.living_room_1)
 * - Zones: groups of bulbs in the same fixture (e.g. light.livingroom_front)
 * - Rooms: all bulbs in a Hue room (e.g. light.living_room)
 *
 * The `lights` array should list CONTROLLABLE FIXTURES — either:
 * - A Hue zone (controls a multi-bulb fixture as one unit)
 * - A standalone bulb NOT inside any Hue zone
 *
 * This avoids double-counting (e.g. listing both a zone AND its individual bulbs).
 */

export interface RoomConfig {
  id: string;
  name: string;
  floor: "ground" | "upstairs" | "outside";
  /** Primary temperature sensor for display */
  temperatureSensor?: string;
  /** Humidity sensor */
  humiditySensor?: string;
  /** CO₂ sensor (ppm) */
  co2Sensor?: string;
  /** Occupancy / motion sensor */
  occupancySensor?: string;
  /**
   * Controllable light fixtures.
   * Use Hue zones for multi-bulb fixtures, standalone bulbs for singles.
   * Do NOT mix a zone with the individual bulbs it contains.
   */
  lights: string[];
  /** Hue room entity for "all lights" toggle */
  lightGroup?: string;
  /** Cover entities (blinds, shades) */
  covers?: string[];
  /** Contact sensors (doors, windows) */
  contactSensors?: { entity: string; label: string; type?: "door" | "window" }[];
  /** Climate entity (radiator or AC) */
  climate?: string[];
  /** Effective target temperature sensor for the climate zone */
  effectiveTarget?: string;
  /** Illuminance sensor (lux) */
  illuminanceSensor?: string;
  /** Noise sensor (dB) */
  noiseSensor?: string;
  /** Atmospheric pressure sensor (hPa) */
  pressureSensor?: string;
  /** Air quality index sensor */
  aqiSensor?: string;
  /** Temperature rate of change sensor (°C/hr, derivative) */
  temperatureRate?: string;
  /** Zone occupancy sensors — replaces generic occupancy with zone-level detail */
  zoneOccupancy?: { entity: string; label: string }[];
  /** Media player entity IDs */
  mediaPlayers?: string[];
  /** Remote entity for TV power control and key commands */
  remoteEntity?: string;
  /** TV platform type for key code mapping */
  tvPlatform?: "androidtv" | "samsung";
  /** Sleep timer entity ID */
  sleepTimer?: string;
  /** Explicit volume control entity (e.g. soundbar DLNA) — overrides auto-detection from mediaPlayers */
  volumeEntity?: string;
}

/**
 * Map HA user name (lowercase) → room ID to pin at top of home view.
 * Users not listed here get no pinned room.
 * Example: { alice: "living_room", bob: "office" }
 */
export const USER_ROOM_MAP: Record<string, string> = {
  // Add entries here: "ha_username_lowercase": "room_id"
};

/**
 * Primary rooms shown on the Home View.
 * Populated by the setup interview — add your rooms here.
 *
 * Example room:
 * {
 *   id: "living_room",
 *   name: "Living Room",
 *   floor: "ground",
 *   temperatureSensor: "sensor.living_room_temperature",
 *   occupancySensor: "binary_sensor.living_room_motion",
 *   lights: ["light.living_room_ceiling", "light.living_room_lamp"],
 *   lightGroup: "light.living_room",
 *   mediaPlayers: ["media_player.living_room_tv"],
 *   remoteEntity: "remote.living_room_tv",
 *   tvPlatform: "androidtv",
 * }
 */
export const ROOMS: RoomConfig[] = [];
