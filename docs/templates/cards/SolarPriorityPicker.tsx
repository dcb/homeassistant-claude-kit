import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useControlCommit } from "../../lib/useControlCommit";

const PRIORITIES = [
  { value: "Auto", icon: "mdi:auto-fix", color: "bg-accent" },
  { value: "Heat First", icon: "mdi:fire", color: "bg-orange-600" },
  { value: "Charge First", icon: "mdi:ev-station", color: "bg-emerald-600" },
];

interface SolarPriorityPickerProps {
  solarPriorityEntity: string;
}

export function SolarPriorityPicker({ solarPriorityEntity }: SolarPriorityPickerProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const serverValue = entities[solarPriorityEntity]?.state ?? "Auto";

  const control = useControlCommit<string>(
    serverValue,
    (option) => {
      if (!connection) return;
      callService(connection, "input_select", "select_option", { option }, { entity_id: solarPriorityEntity });
    },
    { debounceMs: 200 },
  );

  const current = control.displayValue;
  const isInflight = control.phase === "inflight";
  const isDebouncing = control.phase === "debouncing";

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-text-secondary">Solar Priority</h2>
      <div className="flex gap-2">
        {PRIORITIES.map((p) => {
          const isActive = current === p.value;
          return (
            <motion.button
              key={p.value}
              whileTap={{ scale: 0.95 }}
              onClick={() => control.set(p.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? `${p.color} text-white ${isInflight ? "animate-text-glow" : ""} ${isDebouncing ? "opacity-80" : ""}`
                  : "bg-bg-elevated text-text-secondary hover:bg-white/10"
              }`}
            >
              <Icon icon={p.icon} width={14} />
              {p.value}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
