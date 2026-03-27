import { useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { parseNumericState } from "../../lib/format";
import { TemperatureControl } from "./TemperatureControl";
import type { TempPresetsConfig } from "../../lib/entities";

export function TempPresets({ config }: { config: TempPresetsConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const climateMode = entities[config.climateModeEntity]?.state;

  const isSummer = climateMode === "Summer";
  const isOff = climateMode === "Off";

  if (isOff) return null;

  const presets = isSummer ? config.coolingPresets : config.heatingPresets;

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Icon icon="mdi:thermometer" width={16} />
        Temperature Presets
      </h2>
      <div className="space-y-2">
        {presets.map((p) => (
          <TempPresetRow
            key={p.entity}
            entityId={p.entity}
            label={p.label}
            icon={p.icon}
            min={p.min}
            max={p.max}
          />
        ))}
      </div>
    </div>
  );
}

function TempPresetRow({
  entityId,
  label,
  icon,
  min,
  max,
}: {
  entityId: string;
  label: string;
  icon: string;
  min: number;
  max: number;
}) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const serverValue = parseNumericState(entities[entityId]?.state) ?? min;

  const onCommit = useCallback((temp: number) => {
    if (!connection) return;
    callService(connection, "input_number", "set_value", { value: temp }, { entity_id: entityId });
  }, [connection, entityId]);

  return (
    <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} width={16} className="shrink-0 text-text-dim" />
        <span className="text-sm">{label}</span>
      </div>
      <TemperatureControl
        value={serverValue}
        min={min}
        max={max}
        step={0.5}
        onCommit={onCommit}
      />
    </div>
  );
}
