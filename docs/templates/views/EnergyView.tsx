import { lazy, Suspense } from "react";
import { PowerFlowCard } from "../components/cards/PowerFlowCard";
import { SolarPriorityPicker } from "../components/controls/SolarPriorityPicker";
import { EVChargerCard } from "../components/cards/EVChargerCard";
import {
  ENERGY_CONFIG,
  EV_CHARGER_CONFIG,
  SOLAR_CHART_CONFIG,
  SOLAR_PRIORITY,
} from "../lib/entities";

const SolarProductionChart = lazy(() =>
  import("../components/charts/SolarProductionChart").then((m) => ({
    default: m.SolarProductionChart,
  })),
);

export function EnergyView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="text-lg font-semibold">Energy</h1>

      <PowerFlowCard config={ENERGY_CONFIG} />
      <SolarPriorityPicker solarPriorityEntity={SOLAR_PRIORITY} />
      <EVChargerCard config={EV_CHARGER_CONFIG} />

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center rounded-2xl bg-bg-card text-sm text-text-dim">
            Loading chart...
          </div>
        }
      >
        <SolarProductionChart config={SOLAR_CHART_CONFIG} />
      </Suspense>
    </div>
  );
}
