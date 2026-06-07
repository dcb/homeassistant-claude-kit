// useSliderControl.ts
import { useState, useRef, useCallback } from "react";
import {
  useControlCommit,
  type Phase,
} from "./useControlCommit";
import { numericEqual, type NumericControlOptions } from "./useNumericControl";

export interface SliderControlReturn {
  displayValue: number;
  phase: Phase;
  ratio: number;
  dragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: React.PointerEventHandler;
  onPointerMove: React.PointerEventHandler;
  onPointerUp: React.PointerEventHandler;
  onPointerCancel: React.PointerEventHandler;
  onInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onInputPointerUp: React.PointerEventHandler;
}

export function useSliderControl(
  serverValue: number,
  onCommit: (value: number) => void | Promise<void>,
  options: NumericControlOptions,
): SliderControlReturn {
  const { min, max, step, ...commitOpts } = options;

  // Slider commits on pointer-up, no idle debounce
  // Destructure to get stable function references for useCallback deps
  const { displayValue, phase, set, commit, reset } = useControlCommit(serverValue, onCommit, {
    ...commitOpts,
    debounceMs: 60_000, // effectively infinite — we call commit() manually
    isEqual: commitOpts.isEqual ?? numericEqual(step),
  });

  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastValueRef = useRef<number | null>(null);

  const calcValue = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    let val = min + pct * (max - min);
    val = Math.round(val / step) * step;
    if (step < 1) val = parseFloat(val.toFixed(1));
    return Math.max(min, Math.min(max, val));
  }, [min, max, step]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Allow interaction during any phase (optimistic)
    const val = calcValue(e.clientX);
    if (val === null) return;
    // Haptic on initial tap
    if (val !== lastValueRef.current) navigator.vibrate?.(1);
    lastValueRef.current = val;
    set(val);
    draggingRef.current = true;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [calcValue, set]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const val = calcValue(e.clientX);
    if (val === null) return;
    // Haptic tick on step change during drag
    if (val !== lastValueRef.current) navigator.vibrate?.(1);
    lastValueRef.current = val;
    set(val);
  }, [calcValue, set]);

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    commit(); // bypass debounce, fire immediately
  }, [commit]);

  const onPointerCancel = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    reset(); // Clear local state so stale debounce doesn't fire
  }, [reset]);

  // Native <input type="range"> support
  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value);
    if (v !== lastValueRef.current) navigator.vibrate?.(1);
    lastValueRef.current = v;
    set(v);
    if (!draggingRef.current) {
      draggingRef.current = true;
      setDragging(true);
    }
  }, [step, set]);

  const onInputPointerUp = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
    commit();
  }, [commit]);

  const ratio = (displayValue - min) / (max - min);

  return {
    displayValue,
    phase,
    ratio,
    dragging,
    containerRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onInputChange,
    onInputPointerUp,
  };
}
