import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlGroup } from "./useControlGroup";

/**
 * State machine phases for an interactive control:
 * - idle:        Displaying server value, no pending changes
 * - debouncing:  User made a change, waiting before sending to HA
 * - inflight:    Request sent, waiting for server to confirm
 * - correction:  Server value differs from our optimistic value (brief flash)
 */
export type Phase = "idle" | "debouncing" | "inflight" | "correction";

export interface ControlCommitOptions<T> {
  debounceMs?: number;
  isEqual?: (a: T, b: T) => boolean;
  group?: ControlGroup;
}

export interface ControlCommitReturn<T> {
  displayValue: T;
  phase: Phase;
  set: (value: T) => void;
  /** Immediately flush any pending (debouncing) value to HA. No-op when idle or inflight. */
  commit: () => void;
}

export function useControlCommit<T>(
  serverValue: T,
  onCommit: (value: T) => void,
  options: ControlCommitOptions<T> = {},
): ControlCommitReturn<T> {
  const { debounceMs = 300, isEqual = (a, b) => a === b, group } = options;

  const [phase, setPhase] = useState<Phase>("idle");
  const [optimistic, setOptimistic] = useState<T>(serverValue);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const optimisticRef = useRef(optimistic);
  optimisticRef.current = optimistic;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const correctionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (correctionTimer.current) clearTimeout(correctionTimer.current);
  }, []);

  // When server value arrives, decide whether to accept or show correction
  useEffect(() => {
    if (phaseRef.current === "idle") {
      setOptimistic(serverValue);
      return;
    }
    if (phaseRef.current === "inflight") {
      if (isEqual(serverValue, optimisticRef.current)) {
        // Server confirmed our value
        group?.setInflight(false);
        setPhase("idle");
        setOptimistic(serverValue);
      } else {
        // Server disagreed — briefly show correction
        group?.setInflight(false);
        setPhase("correction");
        setOptimistic(serverValue);
        correctionTimer.current = setTimeout(() => {
          setPhase("idle");
        }, 600);
      }
    }
    // In debouncing/correction we let the debounce/timer finish naturally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverValue]);

  useEffect(() => () => { clearTimers(); group?.setInflight(false); }, [clearTimers, group]);

  const set = useCallback(
    (value: T) => {
      clearTimers();
      setOptimistic(value);
      setPhase("debouncing");

      if (debounceMs === 0) {
        // Immediate commit
        group?.setInflight(true);
        setPhase("inflight");
        onCommit(value);
        return;
      }

      debounceTimer.current = setTimeout(() => {
        group?.setInflight(true);
        setPhase("inflight");
        onCommit(value);
      }, debounceMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debounceMs, onCommit, clearTimers, group],
  );

  const commit = useCallback(() => {
    if (phaseRef.current !== "debouncing") return;
    clearTimers();
    group?.setInflight(true);
    setPhase("inflight");
    onCommit(optimisticRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, onCommit, group]);

  const displayValue = phase === "idle" ? serverValue : optimistic;

  return { displayValue, phase, set, commit };
}
