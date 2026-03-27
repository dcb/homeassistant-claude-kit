import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { useControlCommit } from "../../lib/useControlCommit";
import { PopoverSelect } from "./PopoverSelect";

const MODES = [
  { value: "Off", icon: "mdi:power", accent: "text-text-dim" },
  { value: "Winter-Eco", icon: "mdi:snowflake-thermometer", accent: "text-cyan-400" },
  { value: "Winter", icon: "mdi:snowflake", accent: "text-blue-400" },
  { value: "Spring-Autumn", icon: "mdi:flower", accent: "text-emerald-400" },
  { value: "Summer", icon: "mdi:white-balance-sunny", accent: "text-orange-400" },
];

interface ClimateModePickerProps {
  climateModeEntity: string;
}

export function ClimateModePicker({ climateModeEntity }: ClimateModePickerProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const serverValue = entities[climateModeEntity]?.state ?? "Off";

  const { displayValue, phase, set } = useControlCommit<string>(
    serverValue,
    (mode) => {
      if (!connection) return;
      callService(connection, "input_select", "select_option", {
        option: mode,
      }, {
        entity_id: climateModeEntity,
      });
    },
    { debounceMs: 300 },
  );

  const currentMode = MODES.find((m) => m.value === displayValue) ?? MODES[0];

  const items = MODES.map((mode) => ({
    value: mode.value,
    label: (
      <>
        <Icon icon={mode.icon} width={18} className={mode.accent} />
        <span className="flex-1">{mode.value}</span>
        {displayValue === mode.value && (
          <Icon icon="mdi:check" width={16} className="text-accent" />
        )}
      </>
    ),
  }));

  return (
    <PopoverSelect
      items={items}
      value={displayValue}
      onSelect={set}
      phase={phase}
      itemClassName={(active) =>
        `flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
          active ? "bg-white/10 font-medium" : "hover:bg-white/5"
        }`
      }
      trigger={
        <button className="flex w-full items-center gap-3 rounded-2xl bg-bg-card px-4 py-3">
          <Icon icon={currentMode.icon} width={18} className={currentMode.accent} />
          <span className="flex-1 text-left text-sm font-medium">{currentMode.value}</span>
          <Icon icon="mdi:chevron-down" width={18} className="text-text-dim" />
        </button>
      }
    />
  );
}
