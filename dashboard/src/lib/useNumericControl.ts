import { useCallback } from "react";
import { useControlCommit, type ControlCommitReturn, type ControlCommitOptions } from "./useControlCommit";

export interface NumericControlOptions extends ControlCommitOptions<number> {
  min: number;
  max: number;
  step?: number;
}

export interface NumericControlReturn extends ControlCommitReturn<number> {
  increment: () => void;
  decrement: () => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function snapToStep(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export function useNumericControl(
  serverValue: number,
  onCommit: (value: number) => void | Promise<void>,
  options: NumericControlOptions,
): NumericControlReturn {
  const { min, max, step = 1, ...rest } = options;

  const commitFn = useCallback(
    (value: number) => { onCommit(value); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCommit],
  );

  const control = useControlCommit<number>(serverValue, commitFn, rest);

  const adjust = useCallback(
    (delta: number) => {
      const current = control.displayValue;
      const next = clamp(snapToStep(current + delta, step), min, max);
      control.set(next);
    },
    [control, min, max, step],
  );

  const increment = useCallback(() => adjust(step), [adjust, step]);
  const decrement = useCallback(() => adjust(-step), [adjust, step]);

  return { ...control, increment, decrement };
}
