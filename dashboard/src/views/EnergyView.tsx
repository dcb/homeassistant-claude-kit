import { lazy, Suspense } from "react";
import { PowerFlowCard } from "../components/cards/PowerFlowCard";
import { TeslaCarCard } from "../components/cards/TeslaCarCard";
import { WallConnectorCard } from "../components/cards/WallConnectorCard";
import {
  ENERGY_CONFIG,
  EV_STATUS_CONFIG,
  OBELIX_STATUS_CONFIG,
  SOLAR_CHART_CONFIG,
  WALL_CONNECTOR_CONFIG,
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
      <WallConnectorCard config={WALL_CONNECTOR_CONFIG} />

      <div className="grid grid-cols-2 gap-4">
        <TeslaCarCard config={EV_STATUS_CONFIG} />
        <TeslaCarCard config={OBELIX_STATUS_CONFIG} />
      </div>

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
