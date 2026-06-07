// useNumericControl.ts
import { useCallback, useLayoutEffect, useRef } from "react";
import {
  useControlCommit,
  type Phase,
  type ControlCommitOptions,
} from "./useControlCommit";

export interface NumericControlOptions extends ControlCommitOptions<number> {
  min: number;
  max: number;
  step: number;
}

export interface NumericControlReturn {
  displayValue: number;
  phase: Phase;
  set: (value: number) => void;
  commit: () => void;
  increment: () => void;
  decrement: () => void;
}

function clampSnap(value: number, min: number, max: number, step: number) {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function numericEqual(step: number) {
  // Half-step tolerance handles floating-point edge cases for all step sizes
  const tol = step * 0.5;
  return (a: number, b: number) => Math.abs(a - b) < tol;
}

export function useNumericControl(
  serverValue: number,
  onCommit: (value: number) => void | Promise<void>,
  options: NumericControlOptions,
): NumericControlReturn {
  const { min, max, step, ...commitOpts } = options;

  const { displayValue, phase, set, commit } = useControlCommit(serverValue, onCommit, {
    isEqual: numericEqual(step),
    ...commitOpts,
  });

  // Use ref for displayValue to keep increment/decrement callbacks stable
  const displayRef = useRef(displayValue);
  useLayoutEffect(() => { displayRef.current = displayValue; }, [displayValue]);

  const increment = useCallback(() => {
    const next = clampSnap(displayRef.current + step, min, max, step);
    set(next);
  }, [set, step, min, max]);

  const decrement = useCallback(() => {
    const next = clampSnap(displayRef.current - step, min, max, step);
    set(next);
  }, [set, step, min, max]);

  return { displayValue, phase, set, commit, increment, decrement };
}
