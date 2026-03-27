import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { callService } from "home-assistant-js-websocket";
import { useControlCommit } from "../../lib/useControlCommit";

interface ModeButtonProps {
  entityId: string;
  label: string;
  icon: string;
  activeColor?: string;
}

export function ModeButton({
  entityId,
  label,
  icon,
  activeColor = "bg-accent",
}: ModeButtonProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const entity = entities[entityId];
  const isOn = entity?.state === "on";

  const control = useControlCommit<boolean>(
    isOn,
    (_v) => {
      if (!connection) return;
      callService(connection, "input_boolean", "toggle", undefined, {
        entity_id: entityId,
      });
    },
    { debounceMs: 200 },
  );

  const phaseOpacity = control.phase === "debouncing" ? "opacity-70" : "";
  const phaseShake = control.phase === "correction" ? "animate-shake" : "";

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => control.set(!control.displayValue)}
      className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${phaseOpacity} ${phaseShake} ${
        control.displayValue
          ? `${activeColor} text-white`
          : "bg-bg-elevated text-text-secondary hover:bg-white/10"
      }`}
    >
      <Icon icon={icon} width={18} />
      {label}
      {control.phase === "inflight" && (
        <div className="absolute inset-0 rounded-xl border-2 border-transparent border-t-white/60 animate-control-spin" />
      )}
    </motion.button>
  );
}
