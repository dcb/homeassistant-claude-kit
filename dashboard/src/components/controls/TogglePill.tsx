import { motion } from "framer-motion";
import type { Phase } from "../../lib/useControlCommit";

export interface TogglePillProps {
  isOn: boolean;
  onToggle: () => void;
  phase?: Phase;
}

export function TogglePill({ isOn, onToggle, phase = "idle" }: TogglePillProps) {
  const trackOpacity = phase === "debouncing" ? "opacity-70" : "";
  const trackShake = phase === "correction" ? "animate-shake" : "";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center"
    >
      <div className={`h-5 w-9 rounded-full p-0.5 transition-colors duration-200 ${isOn ? "bg-accent-warm" : "bg-white/15"} ${trackOpacity} ${trackShake}`}>
        <motion.div
          className="relative h-4 w-4 rounded-full bg-white shadow"
          animate={{ x: isOn ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {phase === "inflight" && (
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-warm animate-control-spin" />
          )}
        </motion.div>
      </div>
    </button>
  );
}
