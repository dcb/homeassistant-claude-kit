import { Icon } from "@iconify/react";

export interface SolarTotals {
  produced: number;
  consumed: number;
  netCost: number | null;
  peakSolar: number;
  chargerSolar: number;
  chargerGrid: number;
  chargerGridCost: number;
  chargerSolarSaved: number;
}

export interface SolarChartLegendProps {
  hasForecast: boolean;
  hasChargerData: boolean;
  gridPrice: number | null;
  totals: SolarTotals;
}

export function SolarChartLegend({
  hasForecast,
  hasChargerData,
  gridPrice,
  totals,
}: SolarChartLegendProps) {
  return (
    <>
      {/* Legend row */}
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent-warm" />
          Solar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          House
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-green-500" />
          Charger
        </span>
        {hasForecast && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t border-dashed border-accent-warm opacity-50" />
            Forecast
          </span>
        )}
      </div>

      {/* Charger solar/grid breakdown */}
      {hasChargerData && gridPrice !== null && (
        <div className="mt-3 rounded-xl bg-bg-elevated px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            <Icon icon="mdi:ev-station" width={14} />
            Charging breakdown
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            <span className="tabular-nums text-text-dim">
              Total{" "}
              <span className="font-medium text-text-primary">
                {(totals.chargerSolar + totals.chargerGrid).toFixed(1)} kWh
              </span>
            </span>
            {totals.chargerSolar > 0.01 && (
              <span className="tabular-nums text-text-dim">
                Solar{" "}
                <span className="font-medium text-accent-warm">
                  {totals.chargerSolar.toFixed(1)} kWh
                </span>
              </span>
            )}
            {totals.chargerGrid > 0.01 && (
              <span className="tabular-nums text-text-dim">
                Grid{" "}
                <span className="font-medium text-red-400">
                  {totals.chargerGrid.toFixed(1)} kWh
                </span>
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {totals.chargerGrid > 0.01 && (
              <span className="tabular-nums text-text-dim">
                Cost{" "}
                <span className="font-medium text-red-400">
                  {totals.chargerGridCost.toFixed(2)} RON
                </span>
              </span>
            )}
            {totals.chargerSolar > 0.01 && (
              <span className="tabular-nums text-text-dim">
                Saved{" "}
                <span className="font-medium text-green-400">
                  {totals.chargerSolarSaved.toFixed(2)} RON
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
