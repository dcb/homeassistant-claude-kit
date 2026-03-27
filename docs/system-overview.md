# System Overview

> **Instructions:** Fill in each section to describe your actual Home Assistant setup.
> This file tells Claude what hardware, integrations, and entity IDs you have.
> The more detail here, the fewer guesses Claude makes.
> After the setup interview, this file will be populated for you. You can then keep it updated as your setup evolves.

## Home Layout

<!-- Describe your home: floor plan, rooms, which rooms have which sensors/devices -->

- Floors: _
- Rooms: _
- Areas configured in HA: _

## Integrations

<!-- List every integration you've installed and what it controls -->

| Integration | What it controls | Key entities |
|-------------|-----------------|--------------|
| _           | _               | _            |

## Climate System

<!-- Describe your heating/cooling setup -->

- Heating type: (boiler / heat pump / electric / other)
- Zones: _
- TRVs: _
- Thermostat entity: _
- Temperature sensors per room: _

## Lighting

<!-- Describe your lighting setup -->

- Bulb type: (Zigbee / Z-Wave / WiFi / Hue)
- Adaptive Lighting zones: _
- Motion sensors: _
- Scenes used: _

## Energy / Solar

<!-- Only fill in if you have solar/EV -->

- Solar inverter: _
- Inverter integration: _
- Key sensors: `sensor.solar_power`, `sensor.grid_power`, `sensor.battery_level`
- EV charger: (OCPP / other)
- EV: (Tesla / other)

## Security / Cameras

<!-- Only fill in if you have cameras -->

- Camera integration: _
- Cameras: _
- Notification service: _

## Media

<!-- TVs, speakers, projectors -->

- Media players: _
- Remote entities: _

## People / Presence

<!-- Person entities and tracking method -->

- People tracked: _
- Tracking method: (HA companion app / router / BLE)
- Person entities: _

## Key Helpers Registry

<!-- Once the setup interview runs, this section will list all helpers created -->

### Input Booleans
<!-- e.g. input_boolean.night_mode — Night Mode -->

### Input Selects
<!-- e.g. input_select.climate_mode — Climate Mode (Winter/Summer/Off) -->

### Input Numbers
<!-- e.g. input_number.target_temperature — Target Temperature -->

### Input Datetimes
<!-- e.g. input_datetime.morning_work_day — Morning Wake Time (Work Day) -->

## Automation Design Decisions

<!-- Explain non-obvious automation design choices here.
     Example: "Bedroom motion light has a 30s stairs-motion guard to avoid
     sleep disturbance from bed movements." -->

## Known Issues / Workarounds

<!-- Document quirks specific to your hardware here.
     Example: "Dishwasher WiFi dies after cycle end (EU ecodesign) — state
     machine uses input_select that persists independently." -->
