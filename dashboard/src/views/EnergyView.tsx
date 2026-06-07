import { lazy, Suspense } from "react";
import { PowerFlowCard } from "../components/cards/PowerFlowCard";
import { TeslaCarCard } from "../components/cards/TeslaCarCard";
import { ENERGY_CONFIG, EV_STATUS_CONFIG, SOLAR_CHART_CONFIG } from "../lib/entities";

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
      <TeslaCarCard config={EV_STATUS_CONFIG} />
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
