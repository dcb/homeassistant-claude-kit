// Energy view — starter version.
//
// For solar + EV charging, copy from docs/templates/:
//   cards/PowerFlowCard.tsx, cards/EVChargerCard.tsx (+ ManualControls, RuntimeSummary, BatteryGauge)
//   charts/SolarProductionChart.tsx (+ SolarChartLegend, UPlotChart)
//   controls/SolarPriorityPicker.tsx
//   lib/solar-chart-helpers.ts, lib/chart-plugins.ts
//   hooks/useSolarForecast.ts
// Then wire EnergyConfig and EvChargerConfig in entities.ts.

export function EnergyView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <h1 className="text-lg font-semibold">Energy</h1>
      <p className="text-sm text-text-dim">
        Add your energy cards here. See{" "}
        <code>docs/templates/cards/</code> for solar, EV charging, and power
        flow components.
      </p>
    </div>
  );
}
