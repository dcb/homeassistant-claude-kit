# Template Cards

These are **domain-specific dashboard components** — fully working implementations
for common HA setups. They are NOT included in the core dashboard by default because
they require hardware or integrations you may not have.

## How to use

1. Copy the file(s) you need into `dashboard/src/components/`
   (pick the right subdirectory: `cards/`, `charts/`, `controls/`, or `popups/`)
2. Copy any required lib helpers to `dashboard/src/lib/`
3. Add the config type and constant to `dashboard/src/lib/entities.ts`
4. Import and render the card in the appropriate view

## Available templates

### EV Charging (Tesla / OCPP)
- `EVChargerCard.tsx` — Combined OCPP charger + car status card
- `ManualControls.tsx` — Manual charge mode controls
- `RuntimeSummary.tsx` — Session energy and cost summary
- `BatteryGauge.tsx` — Circular EV battery gauge
- `ev-charger-constants.tsx` — OCPP status display constants
- **Config type:** `EvChargerConfig` in `entities.ts`
- **Required lib:** none

### Solar / Energy
- `PowerFlowCard.tsx` — Real-time solar/grid/load power flow
- `SolarProductionChart.tsx` — Historical solar production chart (uPlot)
- `SolarChartLegend.tsx` — Chart legend component
- `UPlotChart.tsx` — Low-level uPlot React wrapper
- `SolarPriorityPicker.tsx` — Solar priority mode picker (control)
- `solar-chart-helpers.ts` — Chart data helpers
- `chart-plugins.ts` — uPlot plugin utilities
- **Config types:** `EnergyConfig`, `SolarChartConfig` in `entities.ts`
- **View:** see `docs/templates/views/EnergyView.tsx`

### Boiler / Central Heating
- `BoilerCard.tsx` — Boiler status, flow/return temps, modulation gauge
- `BoilerDiagCard.tsx` — Detailed boiler telemetry (eBus/OpenTherm)
- **Config types:** `BoilerConfig`, `BoilerDiagConfig` in `entities.ts`

### Heating Zones (TRV / radiators)
- `ZoneCard.tsx` — Per-zone temperature + TRV status card
- `ZoneChart.tsx` — Zone temperature history chart
- `HeatingMonitor.tsx` — Multi-zone heating overview
- `ZoneOverrides.tsx` — Per-zone target temperature sliders (control)
- `ZoneHistoryPopup.tsx` — Zone history popup
- `zone-history-helpers.ts` — Zone history data helpers
- `ClimateModePicker.tsx` — Climate mode picker (Heating/Cooling/Off)
- **Config types:** `BoilerConfig`, `ZoneOverridesConfig`, `ZoneInfo` in `entities.ts`

### AC / Climate
- `AcStatus.tsx` — AC unit status + solar allocation display
- `AcControlPopup.tsx` — AC control popup (mode, temp, fan, swing)
- `TempPresets.tsx` — Day/night/cooling temperature preset quick-set (control)
- `acUnits.ts` — AC unit configuration helpers

### Appliances
- `DishwasherSection.tsx` — Appliance state machine display (hOn integration)
- **Config type:** `ApplianceConfig` in `entities.ts`

---

## Prerequisites by Card

Before copying a domain-specific card into your dashboard, verify that the required
integration, helpers, and automations exist in your Home Assistant instance.

| Card | Required Integration | Helpers to Create | Automations Needed |
|---|---|---|---|
| `EVChargerCard.tsx` | OCPP 1.6 charger (NOT native Tesla Fleet) | `input_select.charger_charge_control` (Solar/Scheduled/Manual/Off) | `config/automations/tesla.yaml` |
| `BoilerCard.tsx` | ebusd (local eBus gateway) | Your boiler's ebusd config file + `input_select.climate_mode` | `config/automations/climate.yaml` |
| `BoilerDiagCard.tsx` | Same as BoilerCard | Same as BoilerCard | Same as BoilerCard |
| `HeatingMonitor.tsx` | Climate entities (TRVs) + Adaptive Lighting | `input_select.climate_mode`, heating hysteresis input_numbers | `config/automations/climate.yaml` |
| `PowerFlowCard.tsx` | Huawei Solar (local LAN, NOT FusionSolar cloud) | None | None |
| `ZoneChart.tsx` | HA history API (built-in) + climate entities | None | None |
| `ZoneHistoryPopup.tsx` | Same as ZoneChart | None | None |
| `DishwasherSection.tsx` | hOn (paroque28 fork) | `input_select.dishwasher_state` | `config/automations/dishwasher.yaml` |
| `SolarProductionChart.tsx` | Huawei Solar energy statistics | None | None |
| `AcControlPopup.tsx` | Sensibo or direct AC integration | Per `acUnits.ts` config | None |

Each card file also has a `@ha-integration`, `@ha-helpers`, and `@ha-automation` JSDoc block
at the top listing exactly what is required. Read the file before wiring entity IDs.

---

### Camera extras
- `CameraStats.tsx` — Per-camera battery, WiFi, and event stats popup section
- `SnapshotHistory.tsx` — Camera snapshot history browser
- `snapshot-api.ts` — HA media_source API helper for snapshots
- `snapshot-utils.ts` — Snapshot filename utilities
