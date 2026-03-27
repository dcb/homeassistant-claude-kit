import { useState, useEffect } from "react";
import { useHass, useUser } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import { ScheduleEditor } from "../components/controls/ScheduleEditor";
import { TempPresets } from "../components/controls/TempPresets";
import {
  SCHEDULE_EDITOR_CONFIG,
  TEMP_PRESETS_CONFIG,
} from "../lib/entities";
import {
  MOTION_TIMEOUTS,
  TRANSITIONS,
} from "./settings-constants";
import {
  SettingSection,
  SubSection,
  NumberRow,
  // BooleanRow, NumericInputRow — uncomment as you add domain-specific settings
} from "../components/controls/SettingControls";

const ADVANCED_KEY = "ha-dashboard:settings-advanced";

export function SettingsView() {
  const connection = useHass((s) => s.connection);
  const user = useUser();
  const isAdmin = user?.is_admin ?? false;

  const [showAdvanced, setShowAdvanced] = useState(
    () => localStorage.getItem(ADVANCED_KEY) === "true",
  );

  useEffect(() => {
    localStorage.setItem(ADVANCED_KEY, String(showAdvanced));
  }, [showAdvanced]);

  const setNumber = (entityId: string, value: number) => {
    if (!connection) return;
    callService(connection, "input_number", "set_value", { value }, { entity_id: entityId });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* Header with Advanced toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        {isAdmin && (
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showAdvanced
                ? "bg-accent-warm/20 text-accent-warm"
                : "bg-white/10 text-text-dim hover:text-text-secondary"
            }`}
          >
            Advanced
          </button>
        )}
      </div>

      {/* Schedules */}
      <ScheduleEditor config={SCHEDULE_EDITOR_CONFIG} />

      {/* Temperature Presets */}
      <TempPresets config={TEMP_PRESETS_CONFIG} />

      {/* Lighting */}
      <SettingSection title="Lighting" icon="mdi:lightbulb-group-outline" defaultExpanded>
        <SubSection title="Motion Timeouts">
          {MOTION_TIMEOUTS.map((c) => (
            <NumberRow key={c.entity} config={c} onChange={setNumber} />
          ))}
        </SubSection>
        <SubSection title="Transitions">
          {TRANSITIONS.map((c) => (
            <NumberRow key={c.entity} config={c} onChange={setNumber} />
          ))}
        </SubSection>
      </SettingSection>

      {/* Domain-specific sections are added here as you configure your setup.
          See settings-constants.ts for examples and the pattern to follow. */}
    </div>
  );
}
