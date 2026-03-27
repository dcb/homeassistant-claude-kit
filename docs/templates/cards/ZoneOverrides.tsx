import { useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { parseNumericState } from "../../lib/format";
import { SliderTrack } from "./SliderTrack";
import { TogglePill } from "./TogglePill";
import { useControlCommit } from "../../lib/useControlCommit";
import { useControlGroup } from "../../lib/useControlGroup";
import { useSliderControl } from "../../lib/useSliderControl";
import type { ZoneOverridesConfig } from "../../lib/entities";

export function ZoneOverrides({ config }: { config: ZoneOverridesConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const climateMode = entities[config.climateModeEntity]?.state;

  const isOff = climateMode === "Off";
  const isSummer = climateMode === "Summer";

  if (isOff || isSummer) return null;

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-text-secondary">Zone Overrides</h2>
      <div className="space-y-2">
        {config.zones.map((z) => (
          <ZoneOverrideRow
            key={z.entity}
            targetEntity={z.entity}
            overrideEntity={z.override}
            label={z.label}
            min={z.min}
            max={z.max}
          />
        ))}
      </div>
    </div>
  );
}

function ZoneOverrideRow({
  targetEntity,
  overrideEntity,
  label,
  min,
  max,
}: {
  targetEntity: string;
  overrideEntity: string;
  label: string;
  min: number;
  max: number;
}) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const serverValue = parseNumericState(entities[targetEntity]?.state) ?? min;
  const isActiveServer = entities[overrideEntity]?.state === "on";

  const group = useControlGroup();

  const toggle = useControlCommit(isActiveServer, () => {
    if (!connection) return;
    callService(connection, "input_boolean", "toggle", {}, { entity_id: overrideEntity });
  }, { debounceMs: 0, group });

  const setTemp = useCallback((temp: number) => {
    if (!connection) return;
    callService(connection, "input_number", "set_value", { value: temp }, { entity_id: targetEntity });
  }, [connection, targetEntity]);

  const isActive = toggle.displayValue;

  const slider = useSliderControl(serverValue, setTemp, { min, max, step: 0.5, group });

  const formatTemp = useCallback((v: number) => `${v.toFixed(1)}°`, []);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
        isActive
          ? "bg-accent/10 ring-1 ring-accent/30"
          : "bg-bg-elevated opacity-60"
      }`}
    >
      <TogglePill isOn={isActive} onToggle={() => toggle.set(!isActive)} phase={toggle.phase} />
      <span className="w-24 shrink-0 text-sm truncate">{label}</span>
      <div className={`flex-1 min-w-0 ${!isActive ? "opacity-40" : ""}`}>
        <SliderTrack
          slider={slider}
          trackGradient="linear-gradient(90deg, #3b82f6, #ef4444)"
          formatValue={formatTemp}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm tabular-nums">
        {formatTemp(slider.displayValue)}
      </span>
    </div>
  );
}
