import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

/* ── Charging state metadata ──────────────────────────────────── */

export const CHARGING_STATES: Record<string, { label: string; color: string; icon: string }> = {
  charging: { label: "Charging", color: "text-accent-green", icon: "mdi:lightning-bolt" },
  starting: { label: "Starting", color: "text-accent-warm", icon: "mdi:lightning-bolt" },
  stopped: { label: "Stopped", color: "text-text-secondary", icon: "mdi:pause-circle" },
  complete: { label: "Complete", color: "text-accent-green", icon: "mdi:check-circle" },
  disconnected: { label: "Disconnected", color: "text-text-dim", icon: "mdi:power-plug-off" },
  no_power: { label: "No Power", color: "text-text-dim", icon: "mdi:power-plug-off" },
};

/* ── Mode selector config ─────────────────────────────────────── */

export type ChargeMode = "Off" | "Solar" | "Fast" | "Manual";

const MODES: { value: ChargeMode; icon: string; color: string }[] = [
  { value: "Off", icon: "mdi:power-off", color: "bg-text-dim" },
  { value: "Solar", icon: "mdi:solar-power-variant", color: "bg-accent-warm" },
  { value: "Fast", icon: "mdi:lightning-bolt", color: "bg-accent-green" },
  { value: "Manual", icon: "mdi:tune-variant", color: "bg-accent" },
];

export const MODE_STATUS: Record<ChargeMode, (charging: boolean) => string> = {
  Off: () => "Charging disabled",
  Solar: (c) => c ? "Charging from solar" : "Waiting for surplus",
  Fast: (c) => c ? "Charging at max rate" : "Starting...",
  Manual: (c) => c ? "Charging (manual)" : "Ready for manual control",
};

/* ── Mode selector (segmented pill) ───────────────────────────── */

interface ModeSelectorProps {
  current: ChargeMode;
  onSelect: (m: ChargeMode) => void;
}

export function ModeSelector({ current, onSelect }: ModeSelectorProps) {
  return (
    <div className="flex gap-1.5 rounded-2xl bg-bg-elevated p-1">
      {MODES.map((m) => {
        const isActive = current === m.value;
        return (
          <motion.button
            key={m.value}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(m.value)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
              isActive
                ? `${m.color} text-white`
                : "text-text-secondary hover:bg-white/5"
            }`}
          >
            <Icon icon={m.icon} width={14} />
            <span className="hidden xs:inline">{m.value}</span>
            <span className="xs:hidden">{m.value}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
