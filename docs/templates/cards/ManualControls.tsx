import { useCallback } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatPower } from "../../lib/format";
import { useSliderControl } from "../../lib/useSliderControl";
import { SliderTrack } from "../controls/SliderTrack";

/* ── Manual mode controls ─────────────────────────────────────── */

interface ManualControlsProps {
  /** Watts mode (OCPP-native): controls input_number.ev_charge_manual_watts */
  watts: number | null;
  isCharging: boolean;
  chargeSwitch: boolean;
  onWattsChange: (w: number) => void;
  onToggle: () => void;
}

export function ManualControls({
  watts,
  isCharging,
  chargeSwitch,
  onWattsChange,
  onToggle,
}: ManualControlsProps) {
  const currentWatts = watts ?? 11040;
  const commitWatts = useCallback((val: number) => onWattsChange(val), [onWattsChange]);
  const slider = useSliderControl(currentWatts, commitWatts, { min: 4800, max: 11040, step: 690 });

  return (
    <div className="space-y-3">
      {/* Watts slider */}
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-xs text-text-dim">Charging rate</span>
          <span className="text-xs font-medium tabular-nums">
            {formatPower(slider.displayValue)}
            <span className="ml-1 text-text-dim">({Math.round(slider.displayValue / 690)}A)</span>
          </span>
        </div>
        <SliderTrack
          slider={slider}
          formatValue={(v) => formatPower(Math.round(v))}
        />
        <div className="flex justify-between px-0.5 text-[10px] text-text-dim">
          <span>4.8 kW</span>
          <span>11 kW</span>
        </div>
      </div>

      {/* Start / Stop button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onToggle}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isCharging || chargeSwitch
            ? "bg-accent-red/20 text-accent-red"
            : "bg-accent-green/20 text-accent-green"
        }`}
      >
        <Icon icon={isCharging || chargeSwitch ? "mdi:stop" : "mdi:play"} width={16} />
        {isCharging || chargeSwitch ? "Stop Charging" : "Start Charging"}
      </motion.button>
    </div>
  );
}
