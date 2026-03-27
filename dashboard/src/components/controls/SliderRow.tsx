import { Icon } from "@iconify/react";
import { useSliderControl } from "../../lib/useSliderControl";
import type { ControlGroup } from "../../lib/useControlGroup";
import { SliderTrack } from "./SliderTrack";

export interface SliderRowProps {
  icon: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Custom equality check for server confirmation (e.g., mired-space for kelvin) */
  isEqual?: (a: number, b: number) => boolean;
  onCommit: (v: number) => void;
  trackGradient: string;
  formatValue?: (v: number) => string;
  dimmed?: boolean;
  group?: ControlGroup;
}

export function SliderRow({
  icon,
  value,
  min,
  max,
  step,
  isEqual,
  onCommit,
  trackGradient,
  formatValue,
  dimmed,
  group,
}: SliderRowProps) {
  const slider = useSliderControl(value, onCommit, { min, max, step: step ?? 1, isEqual, group });

  return (
    <div className={`flex items-center gap-2 ${dimmed ? "opacity-40" : ""}`}>
      <Icon icon={icon} width={14} className="shrink-0 text-text-dim" />
      <SliderTrack slider={slider} trackGradient={trackGradient} formatValue={formatValue} />
      {formatValue && (
        <span className="w-12 text-right text-[10px] tabular-nums text-text-dim shrink-0">
          {formatValue(slider.displayValue)}
        </span>
      )}
    </div>
  );
}
