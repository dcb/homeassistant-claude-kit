// TemperatureControl.tsx
import { useNumericControl } from "../../lib/useNumericControl";
import type { ControlGroup } from "../../lib/useControlGroup";
import { IconButton } from "./IconButton";

interface TemperatureControlProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (temp: number) => void | Promise<void>;
  debounceMs?: number;
  group?: ControlGroup;
}

export function TemperatureControl({
  value,
  min,
  max,
  step,
  onCommit,
  debounceMs = 600,
  group,
}: TemperatureControlProps) {
  const control = useNumericControl(value, onCommit, {
    min, max, step, debounceMs, group,
  });

  const decimals = step < 1 ? 1 : 0;
  const isIdle = control.phase === "idle";
  const isCorrection = control.phase === "correction";

  // Phase-driven classes
  const valueClass = isIdle
    ? "text-text-primary"
    : "text-accent-warm";

  const shakeClass = isCorrection ? "animate-shake" : "";

  // Knight rider underline (inflight only)
  const showKnightRider = control.phase === "inflight";

  return (
    <div className="flex items-center gap-3">
      <IconButton
        icon="mdi:minus"
        variant="ghost"
        onClick={control.decrement}
      />
      <div className={`relative ${shakeClass}`}>
        <span className={`text-2xl font-semibold tabular-nums transition-colors duration-300 ${valueClass}`}>
          {control.displayValue.toFixed(decimals)}
          <span className="text-sm font-normal align-super ml-0.5">&deg;</span>
        </span>
        {showKnightRider && (
          <>
            <div
              className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.15) 15%, rgba(245,158,11,0.15) 85%, transparent 100%)",
              }}
            />
            <div
              className="absolute -bottom-1 h-0.5 rounded-full animate-knight-rider"
              style={{
                width: "30%",
                background: "linear-gradient(90deg, transparent 0%, var(--color-accent-warm) 30%, var(--color-accent-warm) 70%, transparent 100%)",
                boxShadow: "0 0 6px var(--color-accent-warm), 0 0 10px rgba(245,158,11,0.3)",
              }}
            />
          </>
        )}
      </div>
      <IconButton
        icon="mdi:plus"
        variant="ghost"
        onClick={control.increment}
      />
    </div>
  );
}
