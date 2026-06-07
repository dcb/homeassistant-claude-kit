import { useCallback, useRef, useState } from "react";
import type { Phase } from "./useControlCommit";
import type { ControlGroup } from "./useControlGroup";

export interface SliderControlReturn {
  displayValue: number;
  ratio: number;
  phase: Phase;
  dragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  isEqual?: (a: number, b: number) => boolean;
  group?: ControlGroup;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function snap(v: number, step: number) {
  return Math.round(v / step) * step;
}

export function useSliderControl(
  serverValue: number,
  onCommit: (value: number) => void,
  options: SliderOptions,
): SliderControlReturn {
  const { min, max, step = 1, isEqual = (a, b) => a === b, group } = options;

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [localValue, setLocalValue] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<number | null>(null);

  const valueFromPointer = useCallback(
    (e: React.PointerEvent): number => {
      const el = containerRef.current;
      if (!el) return serverValue;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const raw = min + ratio * (max - min);
      return clamp(snap(raw, step), min, max);
    },
    [min, max, step, serverValue],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const val = valueFromPointer(e);
      setDragging(true);
      setPhase("debouncing");
      setLocalValue(val);
      pendingValue.current = val;
    },
    [valueFromPointer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const val = valueFromPointer(e);
      setLocalValue(val);
      pendingValue.current = val;
    },
    [dragging, valueFromPointer],
  );

  const commit = useCallback(() => {
    if (pendingValue.current == null) return;
    const val = pendingValue.current;
    group?.setInflight(true);
    setPhase("inflight");
    onCommit(val);

    // Listen for server confirmation via timeout (simple approach)
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      if (isEqual(val, serverValue)) {
        group?.setInflight(false);
        setPhase("idle");
        setLocalValue(null);
      } else {
        group?.setInflight(false);
        setPhase("correction");
        setLocalValue(serverValue);
        setTimeout(() => {
          setPhase("idle");
          setLocalValue(null);
        }, 600);
      }
    }, 1500);
  }, [onCommit, serverValue, isEqual, group]);

  const onPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      setDragging(false);
      commit();
    },
    [commit],
  );

  const onPointerCancel = useCallback(
    (_e: React.PointerEvent) => {
      setDragging(false);
      setPhase("idle");
      setLocalValue(null);
      pendingValue.current = null;
    },
    [],
  );

  const displayValue = localValue ?? (phase === "idle" ? serverValue : (pendingValue.current ?? serverValue));
  const ratio = clamp((displayValue - min) / (max - min), 0, 1);

  return {
    displayValue,
    ratio,
    phase,
    dragging,
    containerRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
