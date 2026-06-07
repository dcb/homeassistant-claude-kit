/**
 * Well-known entity IDs used across the dashboard.
 * Avoids magic strings scattered through components.
 *
 * Fill in entity IDs during setup (see SETUP.md and the setup-customize skill).
 * All constants are empty strings until configured — the TypeScript build will
 * pass because the `as EntityId` cast is intentional scaffolding.
 */

/**
 * Enforces the `domain.entity_name` format required by Home Assistant.
 * Assigning "" to an EntityId constant is intentional scaffolding during setup.
 * Replace each empty string with your actual entity ID (e.g. "input_select.climate_mode").
 */
export type EntityId = `${string}.${string}`;

// ── Context model ─────────────────────────────────────────────────────────────
export const CLIMATE_MODE = "" as EntityId;  // input_select — values: Comfort, Eco, Away, Off
export const SOLAR_PRIORITY = "" as EntityId; // input_select — values: Battery, EV, Export
export const BOILER = "" as EntityId;         // climate entity (e.g. climate.boiler)

// ── Activity scenes ───────────────────────────────────────────────────────────
export const NIGHT_MODE = "" as EntityId;       // input_boolean
export const MOVIE_MODE = "" as EntityId;       // input_boolean
export const WORK_MODE = "" as EntityId;        // input_boolean
export const AWAY_MODE = "" as EntityId;        // input_boolean
export const WORK_MODE_AUTO = "" as EntityId;   // input_boolean — enables auto work mode on desk presence
export const MOVIE_MODE_AUTO = "" as EntityId;  // input_boolean

// ── Time context ──────────────────────────────────────────────────────────────
export const TIME_OF_DAY = "" as EntityId;  // input_select — values: morning, day, evening, night
export const DAY_TYPE = "" as EntityId;     // input_select — values: workday, weekend

// Presence
export const PERSONS: ReadonlyArray<PersonConfig> = [
  // Add your household members here after setup
  // { id: "person.your_name", name: "Your Name" },
];

// ── Environment ───────────────────────────────────────────────────────────────
export const OUTDOOR_TEMP = "" as EntityId;      // sensor — °C
export const OUTDOOR_HUMIDITY = "" as EntityId;  // sensor — %
export const INDOOR_PRESSURE = "" as EntityId;   // sensor — hPa
export const SOLAR_POWER = "" as EntityId;       // sensor — W (Huawei Solar local integration)
export const WEATHER = "" as EntityId;           // weather entity
export const FORECAST_LOW = "" as EntityId;      // sensor — °C (template sensor from weather forecast)
export const FORECAST_HIGH = "" as EntityId;     // sensor — °C

// ── Energy ────────────────────────────────────────────────────────────────────
export const LOAD_POWER = "" as EntityId;              // sensor — W
export const SPARE_POWER = "" as EntityId;             // sensor — W (template: solar − load − ev)
export const SPARE_POWER_SMOOTHED = "" as EntityId;    // sensor — W (smoothed spare power)
export const GRID_POWER = "" as EntityId;              // sensor — W (positive = import, negative = export)
export const ELECTRICITY_PRICE_GRID = "" as EntityId;  // sensor — €/kWh
export const ELECTRICITY_PRICE_EXPORT = "" as EntityId;// sensor — €/kWh
export const GAS_PRICE = "" as EntityId;               // sensor — €/m³

// ── Charger (OCPP 1.6) ────────────────────────────────────────────────────────
export const CHARGER_POWER = "" as EntityId;          // sensor — W (actual OCPP MeterValues)
export const CHARGER_POWER_OFFERED = "" as EntityId;  // sensor — W (offered to car)
export const CHARGER_CURRENT_OFFERED = "" as EntityId;// sensor — A
export const CHARGER_STATUS = "" as EntityId;         // sensor — OCPP connector state: "Available", "Preparing", "Charging", "Finishing", "Faulted"
export const CHARGER_SESSION_ENERGY = "" as EntityId; // sensor — kWh (current session)
export const CHARGER_TOTAL_ENERGY = "" as EntityId;   // sensor — kWh (lifetime)
export const CHARGER_CHARGE_CONTROL = "" as EntityId; // input_select — values: Solar, Scheduled, Manual, Off

// ── Solar allocation ──────────────────────────────────────────────────────────
export const SOLAR_AC_ALLOCATION = "" as EntityId;       // sensor — W (solar power allocated to AC)
export const SOLAR_CHARGER_MAX_WATTS = "" as EntityId;   // input_number — W
export const ESTIMATED_AC_COP = "" as EntityId;          // input_number — COP multiplier
export const SOLAR_FORECAST_TOMORROW = "" as EntityId;   // sensor — kWh (Solcast or similar)
export const SOLAR_FORECAST_NOW = "" as EntityId;        // sensor — W

// AC manual mode
export const AC_MANUAL_DURATION = "" as EntityId;
export const LR_AC_MANUAL = "" as EntityId;
export const BR_AC_MANUAL = "" as EntityId;
export const LR_AC_TIMER = "" as EntityId;
export const BR_AC_TIMER = "" as EntityId;

// Bedroom silence
export const BEDROOM_SILENCE_START = "" as EntityId;
export const BEDROOM_SILENCE_END = "" as EntityId;

// ── EV / Car (Tesla Fleet integration) ────────────────────────────────────────
// Note: Tesla Fleet integration provides these sensors. They are SUPPLEMENTARY
// to OCPP connector state — OCPP is primary for charging status.
export const EV_BATTERY = "" as EntityId;            // sensor — % SoC
export const EV_USABLE_BATTERY = "" as EntityId;     // sensor — % usable SoC
export const EV_CHARGING = "" as EntityId;           // sensor — state: "charging", "starting", "stopped", "complete", "disconnected"
export const EV_CHARGE_SWITCH = "" as EntityId;      // switch
export const EV_CHARGE_CURRENT = "" as EntityId;     // number — A
export const EV_CHARGE_LIMIT = "" as EntityId;       // number — %
export const EV_CHARGE_CABLE = "" as EntityId;       // binary_sensor — ON = cable connected
export const EV_CHARGE_MODE = "" as EntityId;        // sensor
export const EV_CHARGE_ENERGY = "" as EntityId;      // sensor — kWh (session)
export const EV_TIME_TO_FULL = "" as EntityId;       // sensor — timestamp (ISO datetime when full)
export const EV_EST_RANGE = "" as EntityId;          // sensor — km
// EV — cold weather & scheduling
export const EV_BATTERY_HEATER = "" as EntityId;     // binary_sensor — ON = heater active
export const EV_SCHEDULED_PENDING = "" as EntityId;  // binary_sensor
export const EV_SCHEDULED_ACTIVE = "" as EntityId;   // binary_sensor
export const EV_OUTSIDE_TEMP = "" as EntityId;       // sensor — °C (from car)

// Vacuum
export const VACUUM = "" as EntityId;
export const VACUUM_BATTERY = "" as EntityId;
export const VACUUM_CLEANING_MODE = "" as EntityId;
export const VACUUM_MOVEMENT = "" as EntityId;
export const VACUUM_TURBO_MODE = "" as EntityId;
export const VACUUM_POWER = "" as EntityId;
export const VACUUM_LAMP = "" as EntityId;

// Dishwasher
export const DISHWASHER_STATUS = "" as EntityId;
export const DISHWASHER_PHASE = "" as EntityId;
export const DISHWASHER_PROGRAM = "" as EntityId;
export const DISHWASHER_TIME_REMAINING = "" as EntityId;
export const DISHWASHER_DOOR = "" as EntityId;
export const DISHWASHER_SALT = "" as EntityId;
export const DISHWASHER_RINSE_AID = "" as EntityId;
export const DISHWASHER_CONNECTION = "" as EntityId;
export const DISHWASHER_ERROR = "" as EntityId;
export const DISHWASHER_STATE = "" as EntityId;
export const DISHWASHER_CYCLES = "" as EntityId;

// AC units
export const LR_AC = "" as EntityId;
export const BR_AC = "" as EntityId;

// Projector
export const PROJECTOR = "" as EntityId;

// Doorbell
export const DOORBELL_RINGING = "" as EntityId;

// Snapshot helper
export const SNAPSHOT_SAVE_CAMERA = "" as EntityId; // input_text — triggers snapshot save automation

// Schedule datetimes
export const MORNING_WORK_DAY = "" as EntityId;
export const MORNING_WEEKEND = "" as EntityId;
export const NIGHT_TIME_WORK_DAY = "" as EntityId;
export const NIGHT_TIME_WEEKEND = "" as EntityId;

// Climate zone sensors
export const GROUND_FLOOR_TEMP = "" as EntityId;
export const BEDROOM_TEMP = "" as EntityId;
export const ZONE_3_TEMP = "" as EntityId;
export const BALCONY_TEMP = "" as EntityId;

// Climate zone effective targets
export const GROUND_FLOOR_TARGET = "" as EntityId;
export const BEDROOM_TARGET = "" as EntityId;
export const ZONE_3_TARGET = "" as EntityId;
export const BALCONY_TARGET = "" as EntityId;

// Climate zone override booleans
export const GROUND_FLOOR_OVERRIDE = "" as EntityId;
export const BEDROOM_OVERRIDE = "" as EntityId;
export const ZONE_3_OVERRIDE = "" as EntityId;
export const BALCONY_OVERRIDE = "" as EntityId;

// Climate zone override target temperatures
export const GROUND_FLOOR_OVERRIDE_TARGET = "" as EntityId;
export const BEDROOM_OVERRIDE_TARGET = "" as EntityId;
export const ZONE_3_OVERRIDE_TARGET = "" as EntityId;
export const BALCONY_OVERRIDE_TARGET = "" as EntityId;

// TRVs (thermostatic radiator valves)
export const TRV_LR_COUCH = "" as EntityId;
export const TRV_LR_DESK = "" as EntityId;
export const TRV_LOBBY = "" as EntityId;
export const TRV_KITCHEN = "" as EntityId;
export const TRV_BEDROOM = "" as EntityId;
export const TRV_DRESSING = "" as EntityId;
export const TRV_ZONE_3 = "" as EntityId;
export const TRV_BALCONY = "" as EntityId;

// ── eBus boiler telemetry ─────────────────────────────────────────────────────
// Requires ebusd integration. Entity names depend on your boiler model's ebusd
// message definitions — these will differ across boiler brands and models.
export const BOILER_STATUS = "" as EntityId;           // sensor — ebusd status string (model-specific)
export const BOILER_FLOW_TEMP = "" as EntityId;        // sensor — °C (supply/flow temperature)
export const BOILER_RETURN_TEMP = "" as EntityId;      // sensor — °C
export const BOILER_MODULATION = "" as EntityId;       // sensor — kW (flame power)
export const BOILER_TARGET_FLOW = "" as EntityId;      // sensor — °C (weather-compensated target)
export const BOILER_EFFICIENCY_DELTA = "" as EntityId; // sensor — °C (flow − return delta)
export const BOILER_ROOM_TEMP = "" as EntityId;        // sensor — °C (room temp reported by boiler)
export const BOILER_DHW_TARGET = "" as EntityId;       // sensor — °C (DHW setpoint)
export const BOILER_DIVERTER = "" as EntityId;         // sensor — diverter valve position
export const BOILER_FIXED_TEMP = "" as EntityId;       // number — °C (fixed flow temp override)
export const BOILER_HEATING_STATUS = "" as EntityId;   // binary_sensor — ON = heating active
export const BOILER_EEPROM_COUNTER = "" as EntityId;   // sensor — count (EEPROM write counter)
export const BOILER_UPTIME = "" as EntityId;           // sensor — hours
export const HEATING_CURVE_SLOPE = "" as EntityId;     // input_number
export const HEATING_CURVE_OFFSET = "" as EntityId;    // input_number — °C
export const HEATING_CURVE_ROOM_INFLUENCE = "" as EntityId; // input_number
export const FLOW_TEMP_MAX = "" as EntityId;           // input_number — °C
export const FLOW_TEMP_MIN = "" as EntityId;           // input_number — °C

export interface BoilerConfig {
  /** climate.boiler entity */
  boilerEntity: string;
  /** eBus status sensor (heating hot water / circulating / standby / etc.) */
  boilerStatus: string;
  /** Flow (supply) temperature sensor */
  boilerFlowTemp: string;
  /** Flame power in kW */
  boilerModulation: string;
  /** Weather-compensated target flow temperature sensor */
  boilerTargetFlow: string;
  /** DHW target temperature sensor */
  boilerDhwTarget: string;
  /** Diverter valve position sensor */
  boilerDiverter: string;
  /** Outdoor temperature sensor */
  outdoorTemp: string;
  /** Climate mode input_select (controls Winter / Spring-Autumn / Summer / Off) */
  climateMode: string;
  /** Representative room temperature sensor for the primary heating zone */
  roomTemp: string;
  /** Effective target temperature sensor for the primary heating zone */
  roomTarget: string;
  /** Maximum boiler modulation in kW (used to normalise the power bar). Default: 24 */
  maxModulationKw?: number;
}

export const BOILER_CONFIG: BoilerConfig = {
  boilerEntity: BOILER,
  boilerStatus: BOILER_STATUS,
  boilerFlowTemp: BOILER_FLOW_TEMP,
  boilerModulation: BOILER_MODULATION,
  boilerTargetFlow: BOILER_TARGET_FLOW,
  boilerDhwTarget: BOILER_DHW_TARGET,
  boilerDiverter: BOILER_DIVERTER,
  outdoorTemp: OUTDOOR_TEMP,
  climateMode: CLIMATE_MODE,
  roomTemp: GROUND_FLOOR_TEMP,
  roomTarget: GROUND_FLOOR_TARGET,
  maxModulationKw: 24,
};

// System monitor
export const SYSTEM_CPU = "" as EntityId;
export const SYSTEM_RAM = "" as EntityId;
export const SYSTEM_DISK = "" as EntityId;
export const SYSTEM_LAST_BOOT = "" as EntityId;

// ── Integration health probes ─────────────────────────────────────────────────
// One representative entity per integration — binary_sensor (ON = integration healthy).
// Use entities that go unavailable when the integration disconnects, not sensors that
// simply hold their last known value. Configure in health-constants.ts.
export const PROBE_NETATMO = "" as EntityId;       // binary_sensor — ON = Netatmo connected
export const PROBE_EUFY = "" as EntityId;          // binary_sensor — ON = Eufy connected
export const PROBE_HUAWEI_SOLAR = "" as EntityId;  // binary_sensor — ON = Huawei Solar connected
export const PROBE_SENSIBO = "" as EntityId;       // binary_sensor — ON = Sensibo connected
export const PROBE_TESLA = "" as EntityId;         // binary_sensor — ON = Tesla Fleet connected
export const PROBE_ESPHOME = "" as EntityId;       // binary_sensor — ON = ESPHome device connected
export const PROBE_HUE = "" as EntityId;           // binary_sensor — ON = Philips Hue connected
export const PROBE_HYDRAWISE = "" as EntityId;     // binary_sensor — ON = Hydrawise connected
export const PROBE_OCPP = "" as EntityId;          // binary_sensor — ON = OCPP charger connected

// Stale sensor watchlist
export const STALE_INDOOR_TEMP = "" as EntityId;
export const STALE_LIVINGROOM_LUX = "" as EntityId;

// ── Health automations ────────────────────────────────────────────────────────
// automation entity IDs — format: automation.your_automation_name
export const AUTO_INTEGRATION_MONITOR = "" as EntityId;
export const AUTO_STALE_SENSOR = "" as EntityId;
export const AUTO_EUFY_ADDON = "" as EntityId;
export const AUTO_HUAWEI_WATCHDOG = "" as EntityId;
export const AUTO_OCPP_WATCHDOG = "" as EntityId;
export const AUTO_LOW_BATTERY = "" as EntityId;
export const AUTO_CRITICAL_BATTERY = "" as EntityId;
export const AUTO_RADIATOR_BATTERY = "" as EntityId;
export const AUTO_WEEKLY_BATTERY = "" as EntityId;
export const AUTO_DISK_SPACE = "" as EntityId;
export const AUTO_MEMORY = "" as EntityId;
export const AUTO_HA_RESTART = "" as EntityId;

// Charger power (actual draw via OCPP, for ActiveAutomations)
export const EV_CHARGER_POWER = "" as EntityId;

// Security
export const GATE_LOCK = "" as EntityId;
export const NIGHT_ALERTS = "" as EntityId;

// Schedule transition sensor
export const NEXT_CLIMATE_TRANSITION = "" as EntityId;

// Temperature presets
export const DAY_TEMPERATURE = "" as EntityId;
export const NIGHT_TEMPERATURE = "" as EntityId;
export const COOLING_TARGET = "" as EntityId;
export const COOLING_ECO = "" as EntityId;
export const LR_COOLING_TARGET = "" as EntityId;
export const BR_COOLING_TARGET = "" as EntityId;

// Settings — lighting
export const TIMEOUT_MOTION_NORMAL = "" as EntityId;
export const TIMEOUT_MOTION_NORMAL_LONG = "" as EntityId;
export const TIMEOUT_MOTION_NIGHT = "" as EntityId;
export const TIMEOUT_MOTION_NIGHT_SHORT = "" as EntityId;
export const TIMEOUT_MOTION_MOVIE = "" as EntityId;
export const TRANSITION_ON = "" as EntityId;
export const TRANSITION_OFF = "" as EntityId;
export const BRIGHTNESS_MOVIE = "" as EntityId;
export const BRIGHTNESS_MOVIE_STAIRS = "" as EntityId;
export const COLOR_TEMP_MOVIE = "" as EntityId;
export const LUMINANCE_THRESHOLD_STAIRS = "" as EntityId;
export const LUMINANCE_THRESHOLD_WORK_HIGH = "" as EntityId;
export const LUMINANCE_THRESHOLD_WORK_LOW = "" as EntityId;
export const DESK_LIGHT_MIN_BRIGHTNESS = "" as EntityId;
export const DESK_LIGHT_MAX_BRIGHTNESS = "" as EntityId;
export const WORK_COLOR_TEMP = "" as EntityId;
export const PROJECTOR_OFF_DELAY = "" as EntityId;

// Settings — climate
export const HYSTERESIS_HEAT_ON = "" as EntityId;
export const HYSTERESIS_HEAT_OFF = "" as EntityId;
export const ECO_TEMPERATURE = "" as EntityId;
export const TRV_MIN_TEMPERATURE = "" as EntityId;
export const DHW_TARGET_TEMPERATURE = "" as EntityId;
export const DHW_COMFORT_MODE = "" as EntityId;
export const PREHEAT_FLOW_TEMP_BOOST = "" as EntityId;
export const PREHEAT_FALLBACK_HEATING_RATE = "" as EntityId;
export const PREHEAT_MAX_DURATION = "" as EntityId;
export const BOILER_MIN_CYCLE_MINUTES = "" as EntityId;
export const LEARNED_HEATING_RATE_GF = "" as EntityId;
export const LEARNED_HEATING_RATE_BR = "" as EntityId;
export const LEARNED_HEATING_RATE_TR = "" as EntityId;

// Settings — EV/energy
export const EV_CHARGE_MIN_WATTS = "" as EntityId;
export const EV_CHARGE_MAX_WATTS = "" as EntityId;
export const EV_CHARGE_MANUAL_WATTS = "" as EntityId;
export const EV_CHARGE_RAMP_UP_WATTS = "" as EntityId;
export const EV_CHARGE_IMPORT_BUFFER_WATTS = "" as EntityId;
export const EV_CHARGE_PATIENCE = "" as EntityId;
export const EV_CHARGE_PAUSE_PATIENCE = "" as EntityId;

// Settings — security
// Settings — porch lights
export const PORCH_LIGHTS_ELEVATION_ON = "" as EntityId;
export const PORCH_LIGHTS_ELEVATION_FULL = "" as EntityId;
export const PORCH_LIGHTS_BRIGHTNESS_MIN = "" as EntityId;
export const PORCH_LIGHTS_BRIGHTNESS_MAX = "" as EntityId;

// Settings — security
export const NIGHT_ALARM_DETERRENT = "" as EntityId;
export const ALARM_DETERRENT_DURATION = "" as EntityId;

export interface CameraConfig {
  id: string;
  name: string;
  entity: string;
  /** go2rtc stream name (camera serial number) */
  go2rtcStream: string;
  personSensor: string;
  motionSensor: string;
  eventImage: string;
  batterySensor: string;
  wifiSensor: string;
  chargingSensor: string;
  /** Gate cameras show an unlock button overlay */
  hasGateLock: boolean;
}

/**
 * All 11 Eufy cameras.
 * Names from system-security.md (updated March 2026).
 */
export const CAMERAS: CameraConfig[] = [
  // Add your cameras here after setup — see CameraConfig interface above
  // { id: "doorbell", name: "Doorbell", entity: "camera.doorbell", go2rtcStream: "YOUR_SERIAL", ... }
];

// ─── Component config types ───────────────────────────────────────────────────
// Each type describes the entity IDs a component needs. A matching constant
// wires the private-repo entity IDs. Public-repo entities.ts ships the types
// and empty constants; the setup interview populates the values.

// --- Header ---

export interface PersonConfig {
  id: string;
  name: string;
}

export interface HeaderConfig {
  persons: ReadonlyArray<PersonConfig>;
  climateMode: string;
  outdoorTemp: string;
  weather: string;
}

export const HEADER_CONFIG: HeaderConfig = {
  persons: PERSONS,
  climateMode: CLIMATE_MODE,
  outdoorTemp: OUTDOOR_TEMP,
  weather: WEATHER,
};

// --- QuickActions ---

export interface QuickActionsConfig {
  nightMode: string;
  movieMode: string;
  workMode: string;
  awayMode: string;
  timeOfDay: string;
  projector: string;
}

export const QUICK_ACTIONS_CONFIG: QuickActionsConfig = {
  nightMode: NIGHT_MODE,
  movieMode: MOVIE_MODE,
  workMode: WORK_MODE,
  awayMode: AWAY_MODE,
  timeOfDay: TIME_OF_DAY,
  projector: PROJECTOR,
};

// --- ActiveAutomations ---

export interface ActiveAutomationsConfig {
  nightMode: string;
  movieMode: string;
  workMode: string;
  awayMode: string;
  /** Living-room (ground-floor) AC entity */
  lrAc: string;
  /** Bedroom AC entity */
  brAc: string;
  sparePower: string;
  evCharging: string;
  chargerPower: string;
  chargerPowerOffered: string;
  chargerStatus: string;
}

export const ACTIVE_AUTOMATIONS_CONFIG: ActiveAutomationsConfig = {
  nightMode: NIGHT_MODE,
  movieMode: MOVIE_MODE,
  workMode: WORK_MODE,
  awayMode: AWAY_MODE,
  lrAc: LR_AC,
  brAc: BR_AC,
  sparePower: SPARE_POWER,
  evCharging: EV_CHARGING,
  chargerPower: CHARGER_POWER,
  chargerPowerOffered: CHARGER_POWER_OFFERED,
  chargerStatus: CHARGER_STATUS,
};

// --- EV Charger / Tesla ---

export interface EvChargerConfig {
  // OCPP charger (always available)
  chargerPower: string;
  chargerPowerOffered: string;
  chargerCurrentOffered: string;
  chargerStatus: string;
  chargerSessionEnergy: string;
  chargerChargeControl: string;
  solarChargerMaxWatts: string;
  evChargeManualWatts: string;
  // Car (may be unavailable)
  evBattery: string;
  evUsableBattery: string;
  evCharging: string;
  evChargeLimit: string;
  evChargeCable: string;
  evChargeMode: string;
  evChargeEnergy: string;
  evTimeToFull: string;
  evEstRange: string;
  evBatteryHeater: string;
  evScheduledPending: string;
  evScheduledActive: string;
  /** Display name shown in the car section header */
  carLabel?: string;
}

export const EV_CHARGER_CONFIG: EvChargerConfig = {
  chargerPower: CHARGER_POWER,
  chargerPowerOffered: CHARGER_POWER_OFFERED,
  chargerCurrentOffered: CHARGER_CURRENT_OFFERED,
  chargerStatus: CHARGER_STATUS,
  chargerSessionEnergy: CHARGER_SESSION_ENERGY,
  chargerChargeControl: CHARGER_CHARGE_CONTROL,
  solarChargerMaxWatts: SOLAR_CHARGER_MAX_WATTS,
  evChargeManualWatts: EV_CHARGE_MANUAL_WATTS,
  evBattery: EV_BATTERY,
  evUsableBattery: EV_USABLE_BATTERY,
  evCharging: EV_CHARGING,
  evChargeLimit: EV_CHARGE_LIMIT,
  evChargeCable: EV_CHARGE_CABLE,
  evChargeMode: EV_CHARGE_MODE,
  evChargeEnergy: EV_CHARGE_ENERGY,
  evTimeToFull: EV_TIME_TO_FULL,
  evEstRange: EV_EST_RANGE,
  evBatteryHeater: EV_BATTERY_HEATER,
  evScheduledPending: EV_SCHEDULED_PENDING,
  evScheduledActive: EV_SCHEDULED_ACTIVE,
  carLabel: "Your EV",
};

// --- Energy / Power Flow ---

export interface EnergyConfig {
  solarPower: string;
  loadPower: string;
  gridPower: string;
  chargerPowerImport: string;
  chargerPowerOffered: string;
  chargerStatus: string;
}

export const ENERGY_CONFIG: EnergyConfig = {
  solarPower: SOLAR_POWER,
  loadPower: LOAD_POWER,
  gridPower: GRID_POWER,
  chargerPowerImport: CHARGER_POWER,
  chargerPowerOffered: CHARGER_POWER_OFFERED,
  chargerStatus: CHARGER_STATUS,
};

// --- Solar Chart ---

export interface SolarChartConfig {
  solarPower: string;
  loadPower: string;
  gridPower: string;
  chargerPowerImport: string;
  chargerPowerOffered: string;
  chargerStatus: string;
  electricityPriceGrid: string;
  electricityPriceExport: string;
}

export const SOLAR_CHART_CONFIG: SolarChartConfig = {
  solarPower: SOLAR_POWER,
  loadPower: LOAD_POWER,
  gridPower: GRID_POWER,
  chargerPowerImport: CHARGER_POWER,
  chargerPowerOffered: CHARGER_POWER_OFFERED,
  chargerStatus: CHARGER_STATUS,
  electricityPriceGrid: ELECTRICITY_PRICE_GRID,
  electricityPriceExport: ELECTRICITY_PRICE_EXPORT,
};

// --- Vacuum ---

export interface VacuumConfig {
  vacuum: string;
  battery: string;
  cleaningMode: string;
  movement: string;
  turboMode: string;
  power: string;
  lamp: string;
}

export const VACUUM_CONFIG: VacuumConfig = {
  vacuum: VACUUM,
  battery: VACUUM_BATTERY,
  cleaningMode: VACUUM_CLEANING_MODE,
  movement: VACUUM_MOVEMENT,
  turboMode: VACUUM_TURBO_MODE,
  power: VACUUM_POWER,
  lamp: VACUUM_LAMP,
};

// --- Appliance (dishwasher / generic state-machine appliance) ---

export interface ApplianceConfig {
  status: string;
  phase: string;
  program: string;
  timeRemaining: string;
  saltLevel: string;
  rinseAidLevel: string;
  /** input_select tracking HA-side state (persists across WiFi drops) */
  state: string;
  cycles: string;
  error: string;
}

export const DISHWASHER_CONFIG: ApplianceConfig = {
  status: DISHWASHER_STATUS,
  phase: DISHWASHER_PHASE,
  program: DISHWASHER_PROGRAM,
  timeRemaining: DISHWASHER_TIME_REMAINING,
  saltLevel: DISHWASHER_SALT,
  rinseAidLevel: DISHWASHER_RINSE_AID,
  state: DISHWASHER_STATE,
  cycles: DISHWASHER_CYCLES,
  error: DISHWASHER_ERROR,
};

// --- Context Card (home overview: energy + weather summary) ---

export interface ContextConfig {
  boilerEntity: string;
  solarPower: string;
  loadPower: string;
  chargerPower: string;
  chargerPowerOffered: string;
  chargerStatus: string;
  evBattery: string;
  evCharging: string;
  timeOfDay: string;
  outdoorTemp: string;
  outdoorHumidity: string;
  indoorPressure: string;
  weather: string;
  forecastLow: string;
  forecastHigh: string;
}

export const CONTEXT_CONFIG: ContextConfig = {
  boilerEntity: BOILER,
  solarPower: SOLAR_POWER,
  loadPower: LOAD_POWER,
  chargerPower: CHARGER_POWER,
  chargerPowerOffered: CHARGER_POWER_OFFERED,
  chargerStatus: CHARGER_STATUS,
  evBattery: EV_BATTERY,
  evCharging: EV_CHARGING,
  timeOfDay: TIME_OF_DAY,
  outdoorTemp: OUTDOOR_TEMP,
  outdoorHumidity: OUTDOOR_HUMIDITY,
  indoorPressure: INDOOR_PRESSURE,
  weather: WEATHER,
  forecastLow: FORECAST_LOW,
  forecastHigh: FORECAST_HIGH,
};

// --- Boiler Diagnostics Card ---

export interface BoilerDiagConfig {
  status: string;
  flowTemp: string;
  returnTemp: string;
  modulation: string;
  targetFlow: string;
  diverter: string;
  dhwTarget: string;
  fixedTemp: string;
  heatingStatus: string;
  eepromCounter: string;
  uptime: string;
  efficiencyDelta: string;
  heatingCurveSlope: string;
  heatingCurveOffset: string;
  heatingCurveRoomInfluence: string;
  flowTempMax: string;
  flowTempMin: string;
}

export const BOILER_DIAG_CONFIG: BoilerDiagConfig = {
  status: BOILER_STATUS,
  flowTemp: BOILER_FLOW_TEMP,
  returnTemp: BOILER_RETURN_TEMP,
  modulation: BOILER_MODULATION,
  targetFlow: BOILER_TARGET_FLOW,
  diverter: BOILER_DIVERTER,
  dhwTarget: BOILER_DHW_TARGET,
  fixedTemp: BOILER_FIXED_TEMP,
  heatingStatus: BOILER_HEATING_STATUS,
  eepromCounter: BOILER_EEPROM_COUNTER,
  uptime: BOILER_UPTIME,
  efficiencyDelta: BOILER_EFFICIENCY_DELTA,
  heatingCurveSlope: HEATING_CURVE_SLOPE,
  heatingCurveOffset: HEATING_CURVE_OFFSET,
  heatingCurveRoomInfluence: HEATING_CURVE_ROOM_INFLUENCE,
  flowTempMax: FLOW_TEMP_MAX,
  flowTempMin: FLOW_TEMP_MIN,
};

// --- Temperature Presets (Settings: day/night/cooling targets) ---

export interface TempPresetItem {
  entity: string;
  label: string;
  icon: string;
  min: number;
  max: number;
}

export interface TempPresetsConfig {
  climateModeEntity: string;
  heatingPresets: TempPresetItem[];
  coolingPresets: TempPresetItem[];
}

export const TEMP_PRESETS_CONFIG: TempPresetsConfig = {
  climateModeEntity: CLIMATE_MODE,
  heatingPresets: [
    { entity: DAY_TEMPERATURE, label: "Day", icon: "mdi:white-balance-sunny", min: 15, max: 25 },
    { entity: NIGHT_TEMPERATURE, label: "Night", icon: "mdi:weather-night", min: 15, max: 25 },
  ],
  coolingPresets: [
    { entity: COOLING_TARGET, label: "Cooling", icon: "mdi:snowflake", min: 18, max: 32 },
    { entity: COOLING_ECO, label: "Cooling Eco", icon: "mdi:snowflake-off", min: 18, max: 32 },
    { entity: LR_COOLING_TARGET, label: "Living Room", icon: "mdi:sofa", min: 18, max: 32 },
    { entity: BR_COOLING_TARGET, label: "Bedroom", icon: "mdi:bed", min: 18, max: 32 },
  ],
};

// --- Zone Overrides (Climate: per-zone target temp sliders) ---

export interface ZoneOverrideItem {
  entity: string;
  override: string;
  label: string;
  min: number;
  max: number;
}

export interface ZoneOverridesConfig {
  climateModeEntity: string;
  zones: ZoneOverrideItem[];
}

export const ZONE_OVERRIDES_CONFIG: ZoneOverridesConfig = {
  climateModeEntity: CLIMATE_MODE,
  zones: [
    { entity: GROUND_FLOOR_OVERRIDE_TARGET, override: GROUND_FLOOR_OVERRIDE, label: "Ground Floor", min: 15, max: 28 },
    { entity: BEDROOM_OVERRIDE_TARGET, override: BEDROOM_OVERRIDE, label: "Bedroom", min: 15, max: 28 },
    { entity: ZONE_3_OVERRIDE_TARGET, override: ZONE_3_OVERRIDE, label: "Room 3", min: 15, max: 28 },
    { entity: BALCONY_OVERRIDE_TARGET, override: BALCONY_OVERRIDE, label: "Balcony", min: 3, max: 20 }, // min: 3 — frost protection (outdoor/semi-outdoor zone, do not raise)
  ],
};

// --- Schedule Editor (Settings: morning/bedtime/quiet-hours time inputs) ---

export interface ScheduleItemConfig {
  entity: string;
  label: string;
  icon: string;
}

export interface ScheduleGroupConfig {
  title: string;
  items: ScheduleItemConfig[];
}

export type ScheduleEditorConfig = ScheduleGroupConfig[];

export const SCHEDULE_EDITOR_CONFIG: ScheduleEditorConfig = [
  {
    title: "Mornings",
    items: [
      { entity: MORNING_WORK_DAY, label: "Work Day", icon: "mdi:briefcase" },
      { entity: MORNING_WEEKEND, label: "Weekend", icon: "mdi:sleep" },
    ],
  },
  {
    title: "Bedtimes",
    items: [
      { entity: NIGHT_TIME_WORK_DAY, label: "Work Day", icon: "mdi:briefcase" },
      { entity: NIGHT_TIME_WEEKEND, label: "Weekend", icon: "mdi:sleep" },
    ],
  },
  {
    title: "Quiet Hours",
    items: [
      { entity: BEDROOM_SILENCE_START, label: "Silence Start", icon: "mdi:volume-off" },
      { entity: BEDROOM_SILENCE_END, label: "Silence End", icon: "mdi:volume-high" },
    ],
  },
];

// --- Room–Zone mapping (used by ClimateSection in RoomPopup) ---

export interface ZoneInfo {
  name: string;
  sensorId: string;
  targetId: string;
  overrideBoolean: string;
  overrideTarget: string;
  acEntity?: string;
}

// Keys must exactly match RoomConfig.id values defined in lib/areas.ts.
// Adding a room here without a matching RoomConfig.id in areas.ts means the
// ClimateSection popup will silently receive no zone data for that room.
export const ROOM_ZONE_MAP: Record<string, ZoneInfo> = {
  living_room: {
    name: "Ground Floor",
    sensorId: GROUND_FLOOR_TEMP,
    targetId: GROUND_FLOOR_TARGET,
    overrideBoolean: GROUND_FLOOR_OVERRIDE,
    overrideTarget: GROUND_FLOOR_OVERRIDE_TARGET,
    acEntity: LR_AC,
  },
  kitchen: {
    name: "Ground Floor",
    sensorId: GROUND_FLOOR_TEMP,
    targetId: GROUND_FLOOR_TARGET,
    overrideBoolean: GROUND_FLOOR_OVERRIDE,
    overrideTarget: GROUND_FLOOR_OVERRIDE_TARGET,
    acEntity: LR_AC,
  },
  bedroom: {
    name: "Bedroom",
    sensorId: BEDROOM_TEMP,
    targetId: BEDROOM_TARGET,
    overrideBoolean: BEDROOM_OVERRIDE,
    overrideTarget: BEDROOM_OVERRIDE_TARGET,
    acEntity: BR_AC,
  },
  room_3: {
    name: "Room 3",
    sensorId: ZONE_3_TEMP,
    targetId: ZONE_3_TARGET,
    overrideBoolean: ZONE_3_OVERRIDE,
    overrideTarget: ZONE_3_OVERRIDE_TARGET,
  },
  balcony: {
    name: "Balcony",
    sensorId: BALCONY_TEMP,
    targetId: BALCONY_TARGET,
    overrideBoolean: BALCONY_OVERRIDE,
    overrideTarget: BALCONY_OVERRIDE_TARGET,
  },
};

// ── Irrigation ────────────────────────────────────────────────────────────────
//
// The irrigation view drives a YAML-side scheduler (see docs/templates/config in
// the kit) through a fixed set of HA helpers. The entity IDs below follow the
// kit's naming convention — create the matching helpers in Home Assistant and
// these constants will line up automatically.
//
// Irrigation — global controls / scheduler state
export const IRRIGATION_ENABLED = "input_boolean.irrigation_enabled";
export const IRRIGATION_HEAT_BOOST = "input_boolean.irrigation_heat_boost";
export const IRRIGATION_MANUAL_STOP = "input_boolean.irrigation_manual_stop";
export const IRRIGATION_FREQUENCY = "input_select.irrigation_frequency";
export const IRRIGATION_PAUSE_DAYS = "input_number.irrigation_pause_days";
export const IRRIGATION_RAIN_SKIP_MM = "input_number.irrigation_rain_skip_mm";
export const IRRIGATION_RAIN_HISTORY_SKIP_MM = "input_number.irrigation_rain_history_skip_mm";
export const IRRIGATION_WIND_SKIP_KMH = "input_number.irrigation_wind_skip_kmh";
export const IRRIGATION_FREEZE_TEMP = "input_number.irrigation_freeze_temp";
export const IRRIGATION_SEASONAL_COLD_TEMP = "input_number.irrigation_seasonal_cold_temp";
export const IRRIGATION_START_HOUR = "input_number.irrigation_start_time_hour";
export const IRRIGATION_START_MINUTE = "input_number.irrigation_start_time_minute";
export const IRRIGATION_END_HOUR = "input_number.irrigation_end_hour";

// Irrigation — weather sensors
export const IRRIGATION_RAIN_YESTERDAY = "sensor.irrigation_rain_yesterday";
export const IRRIGATION_RAIN_TODAY = "sensor.irrigation_rain_today";
export const IRRIGATION_RAIN_FORECAST = "sensor.irrigation_rain_forecast_tomorrow";
export const IRRIGATION_PRECIP_FORECAST_24H = "sensor.irrigation_precip_forecast_24h";

// Irrigation — skip sensors
export const IRRIGATION_SKIP_RAIN_FORECAST = "binary_sensor.irrigation_skip_rain_forecast";
export const IRRIGATION_SKIP_RAIN_ACTUAL = "binary_sensor.irrigation_skip_rain_actual";
export const IRRIGATION_SKIP_WIND = "binary_sensor.irrigation_skip_wind";
export const IRRIGATION_SKIP_FREEZE = "binary_sensor.irrigation_skip_freeze";
export const IRRIGATION_SKIP_SEASONAL_COLD = "binary_sensor.irrigation_skip_seasonal_cold";
export const IRRIGATION_SKIP_ANY = "binary_sensor.irrigation_skip_any";

// Irrigation — state tracking
export const IRRIGATION_LAST_RUN_STATUS = "input_text.irrigation_last_run_status";
export const IRRIGATION_LAST_RUN_DETAILS = "input_text.irrigation_last_run_details";
export const IRRIGATION_LAST_RUN_DATE = "input_datetime.irrigation_last_run_date";
export const IRRIGATION_LAST_RUN_SKIPPED_ZONES = "input_text.irrigation_last_run_skipped_zones";
export const IRRIGATION_PAUSE_UNTIL = "input_datetime.irrigation_pause_until";
export const IRRIGATION_RUN_NOW = "input_boolean.irrigation_run_now";

// Optional connectivity sensor for your valve controller (Hydrawise /
// OpenSprinkler / Rachio / …). If present, the view disables "Run now" and
// shows an "offline" status when the controller drops off the network. Leave
// the helper uncreated if your controller has no such sensor.
export const IRRIGATION_CONNECTIVITY = "binary_sensor.irrigation_connectivity";

// Prerequisite template sensor you must provide: a rolling 3-day average of the
// outdoor temperature, used by the "seasonal cold" skip row. Build it with a
// statistics sensor (mean over 3 days) or a template over OUTDOOR_TEMP history.
export const IRRIGATION_TEMP_3_DAY_AVG = "sensor.outdoor_temperature_3_day_average";

// Irrigation — zone config
export interface IrrigationZoneConfig {
  slug: string;
  name: string;
  defaultGroup: "front" | "back";
  valve: string;
  watering: string;
  remaining: string;
  enabled: string;
  manualRun: string;
  running: string;
  cycleMinutes: string;
  cycles: string;
  soakMinutes: string;
  seasonalPct: string;
  group: string;
}

function irrigationZone(slug: string, name: string, defaultGroup: "front" | "back"): IrrigationZoneConfig {
  return {
    slug,
    name,
    defaultGroup,
    valve: `valve.${slug}`,
    watering: `binary_sensor.${slug}_watering`,
    remaining: `sensor.${slug}_remaining_watering_time`,
    enabled: `input_boolean.irrigation_zone_${slug}_enabled`,
    manualRun: `input_boolean.irrigation_zone_${slug}_manual_run`,
    running: `input_boolean.irrigation_zone_${slug}_running`,
    cycleMinutes: `input_number.irrigation_zone_${slug}_cycle_minutes`,
    cycles: `input_number.irrigation_zone_${slug}_cycles`,
    soakMinutes: `input_number.irrigation_zone_${slug}_soak_minutes`,
    seasonalPct: `input_number.irrigation_zone_${slug}_seasonal_pct`,
    group: `input_select.irrigation_zone_${slug}_group`,
  };
}

// Each zone derives all of its entity IDs from its `slug` via `irrigationZone()`:
//   - `valve.{slug}`                         — the valve entity exposed by your
//                                              controller (the hardware actuator)
//   - `binary_sensor.{slug}_watering`        — "actively watering" sensor; the
//                                              view pairs its on→off transitions
//                                              into the run-history timeline
//   - `sensor.{slug}_remaining_watering_time`— optional remaining-time sensor
//   - `input_*.irrigation_zone_{slug}_*`     — the per-zone HA helpers you create
//                                              (enabled / manual_run / running /
//                                              cycle_minutes / cycles /
//                                              soak_minutes / seasonal_pct / group)
//
// Front/back group model: every zone belongs to either the "front" or "back"
// group. The scheduler waters one group per run based on the chosen frequency
// (e.g. front on even days, back on odd days), so you can split a property into
// two halves and alternate watering between them.
//
// To add a zone: add one `irrigationZone(slug, label, group)` line below AND
// create the matching Home Assistant helpers (see docs/templates/config in the
// kit). The two zones here are placeholders — replace them with your own.
export const IRRIGATION_ZONES: IrrigationZoneConfig[] = [
  irrigationZone("front_zone_1", "Front Zone 1", "front"),
  irrigationZone("back_zone_1", "Back Zone 1", "back"),
];

export type IrrigationGroup = "front" | "back";

export function isIrrigationGroup(s: string | undefined): s is IrrigationGroup {
  return s === "front" || s === "back";
}

/** Single source of truth for the effective per-cycle runtime — used by both the
 * card display and the popup header so they can't disagree. Mirrors the daily
 * scheduler's per-zone effective_minutes_safe formula. */
export function effectiveCycleMinutes(cycleMin: number, seasonalPct: number): number {
  return Math.max(1, Math.round(cycleMin * seasonalPct / 100));
}

export interface IrrigationZoneNumericParam {
  entity: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Fallback value if the helper is unavailable/unknown at popup mount. */
  fallback: number;
}

/** Per-zone tunable numeric parameters, mirroring the configuration ranges. */
export function irrigationZoneNumericParams(zone: IrrigationZoneConfig): {
  cycleMinutes: IrrigationZoneNumericParam;
  cycles: IrrigationZoneNumericParam;
  soakMinutes: IrrigationZoneNumericParam;
  seasonalPct: IrrigationZoneNumericParam;
} {
  return {
    cycleMinutes: { entity: zone.cycleMinutes, label: "Cycle minutes",        unit: " min", min: 0.5, max: 60,  step: 0.5, fallback: 5 },
    cycles:       { entity: zone.cycles,       label: "Cycles",               unit: "",     min: 1,   max: 5,   step: 1,   fallback: 1 },
    soakMinutes:  { entity: zone.soakMinutes,  label: "Soak between cycles",  unit: " min", min: 5,   max: 60,  step: 5,   fallback: 20 },
    seasonalPct:  { entity: zone.seasonalPct,  label: "Seasonal adjustment",  unit: "%",    min: 10,  max: 200, step: 5,   fallback: 100 },
  };
}
