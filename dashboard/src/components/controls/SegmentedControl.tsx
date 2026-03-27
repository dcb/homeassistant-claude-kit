import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { Phase } from "../../lib/useControlCommit";

export interface SegmentOption {
  value: string;
  label: string;
  icon: string;
}

export interface SegmentedControlProps {
  label: string;
  value: string;
  phase?: Phase;
  options: SegmentOption[];
  onChange: (value: string) => void;
}

export function SegmentedControl({
  label,
  value,
  phase,
  options,
  onChange,
}: SegmentedControlProps) {
  const isInflight = phase === "inflight";
  const isCorrection = phase === "correction";
  const isBlocked = isInflight || isCorrection;

  const activeIdx = options.findIndex(
    (o) => o.value.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-text-dim">
        {label}
      </div>
      <div className={`relative flex rounded-xl bg-bg-elevated p-1 ${isBlocked ? "opacity-60 pointer-events-none" : ""}`}>
        {/* Sliding indicator */}
        {activeIdx >= 0 && (
          <motion.div
            className={`absolute inset-y-1 rounded-lg ring-1 ${isBlocked ? "bg-accent-warm/20 ring-accent-warm/40" : "bg-accent/20 ring-accent/40"} ${isCorrection ? "animate-shake" : ""}`}
            initial={false}
            animate={{
              left: `calc(${(activeIdx / options.length) * 100}% + 4px)`,
              width: `calc(${100 / options.length}% - 8px)`,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        {options.map((opt) => {
          const isOptActive = opt.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={opt.value}
              disabled={!!isBlocked}
              onClick={() => onChange(opt.value)}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isOptActive
                  ? isBlocked ? `text-accent-warm${isInflight ? " animate-text-glow" : ""}` : "text-accent"
                  : "text-text-secondary"
              }`}
            >
              <Icon icon={opt.icon} width={14} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
