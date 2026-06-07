// useControlCommit.ts
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { ControlGroup } from "./useControlGroup";

export type Phase = "idle" | "debouncing" | "inflight" | "correction";

export interface ControlCommitOptions<T> {
  debounceMs?: number;
  timeoutMs?: number;
  holdMs?: number;
  isEqual?: (a: T, b: T) => boolean;
  /** Shared group — freezes idle siblings while any member is inflight */
  group?: ControlGroup;
}

export interface ControlCommitReturn<T> {
  displayValue: T;
  phase: Phase;
  set: (value: T) => void;
  commit: () => void;
  reset: () => void;
}

export function useControlCommit<T>(
  serverValue: T,
  onCommit: (value: T) => void | Promise<void>,
  options?: ControlCommitOptions<T>,
): ControlCommitReturn<T> {
  const {
    debounceMs = 300,
    timeoutMs = 15_000,
    holdMs = 3_000,
    isEqual = (a: T, b: T) => a === b,
    group,
  } = options ?? {};

  const [localValue, setLocalValue] = useState<T | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  // Refs to avoid stale closures
  const localRef = useRef<T | null>(null);
  const sentRef = useRef<T | null>(null);
  const serverRef = useRef(serverValue);
  const onCommitRef = useRef(onCommit);
  const isEqualRef = useRef(isEqual);
  const groupRef = useRef(group);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflightRef = useRef(false);
  const correctionRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Snapshot of serverValue when group went busy and this hook was idle
  const frozenServerRef = useRef<T | null>(null);

  useLayoutEffect(() => { serverRef.current = serverValue; }, [serverValue]);
  useLayoutEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useLayoutEffect(() => { isEqualRef.current = isEqual; }, [isEqual]);
  useLayoutEffect(() => { groupRef.current = group; }, [group]);

  // Freeze display when idle and a sibling in the group is inflight
  const isIdle = sentRef.current === null && localRef.current === null && holdRef.current === undefined;
  const siblingBusy = group?.busyRef.current && isIdle;
  if (siblingBusy && frozenServerRef.current === null) {
    frozenServerRef.current = serverValue;
  }
  if (!siblingBusy) {
    frozenServerRef.current = null;
  }

  // Post-confirmation hold: keeps localValue displayed briefly to absorb
  // device-revert flicker (e.g., HA optimistic update → slow device reverts → device confirms)
  const startHold = useCallback(() => {
    clearTimeout(holdRef.current);
    holdRef.current = setTimeout(() => {
      holdRef.current = undefined;
      if (inflightRef.current || sentRef.current !== null || localRef.current === null) return;
      const eq = isEqualRef.current;
      if (eq(serverRef.current, localRef.current)) {
        // Server agrees — clean clear
        localRef.current = null;
        setLocalValue(null);
      } else {
        // Server disagrees after hold — genuine correction
        localRef.current = null;
        setLocalValue(null);
        setPhase("correction");
        correctionRef.current = setTimeout(() => setPhase("idle"), 700);
      }
    }, holdMs);
  }, [holdMs]);

  // Fire the service call
  const fire = useCallback((value: T) => {
    // Skip no-op: server already has this value
    if (isEqualRef.current(serverRef.current, value)) {
      clearTimeout(holdRef.current);
      holdRef.current = undefined;
      localRef.current = null;
      setLocalValue(null);
      setPhase("idle");
      return;
    }

    groupRef.current?.enter();
    sentRef.current = value;
    inflightRef.current = true;
    setPhase("inflight");

    // Safety timeout — stops inflight animation but holds optimistic display
    clearTimeout(safetyRef.current);
    safetyRef.current = setTimeout(() => {
      inflightRef.current = false;
      sentRef.current = null;
      groupRef.current?.leave();
      setPhase("idle");
      startHold();
    }, timeoutMs);

    const result = onCommitRef.current(value);
    if (result && typeof result.then === "function") {
      result.then(() => {
        // Promise resolved = command acknowledged, but we still wait for
        // serverValue to match before clearing. This is just a hint.
      });
    }
  }, [timeoutMs, startHold]);

  // Handle server value changes
  useEffect(() => {
    if (sentRef.current === null) {
      // Not waiting for a response.
      // If frozen (sibling inflight), skip all server value processing
      if (groupRef.current?.busyRef.current && localRef.current === null && holdRef.current === undefined) {
        return;
      }
      // During hold: if server now agrees with local, clear hold early.
      if (localRef.current !== null && holdRef.current !== undefined) {
        if (isEqualRef.current(serverValue, localRef.current)) {
          clearTimeout(holdRef.current);
          holdRef.current = undefined;
          localRef.current = null;
          setLocalValue(null);
        }
        // If server disagrees during hold, keep local displayed (prevents flash)
      }
      return;
    }

    if (isEqualRef.current(serverValue, sentRef.current)) {
      // Server confirmed the sent value
      clearTimeout(safetyRef.current);
      inflightRef.current = false;
      sentRef.current = null;
      groupRef.current?.leave();

      // Check if user changed value while inflight
      if (localRef.current !== null && !isEqualRef.current(localRef.current, serverValue)) {
        // Queue: fire again with the user's latest value
        const queued = localRef.current;
        fire(queued);
      } else {
        // Confirmed — hold to prevent device-revert flash
        setPhase("idle");
        startHold();
      }
    }
    // If inflight and server doesn't match sent: ignore.
    // Intermediate device updates (e.g., slow AC reporting 19.5, 20.0, 20.5...)
    // are not treated as corrections. Safety timeout is the backstop.
  }, [serverValue, fire, startHold]);

  // Set local value and restart debounce
  const set = useCallback((value: T) => {
    clearTimeout(holdRef.current);
    holdRef.current = undefined;
    localRef.current = value;
    setLocalValue(value);

    if (!inflightRef.current) {
      setPhase("debouncing");
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (localRef.current !== null) {
          fire(localRef.current);
        }
      }, debounceMs);
    }
    // If inflight, just update local — will be queued on confirmation
  }, [debounceMs, fire]);

  // Force immediate commit (for blur/Enter on text inputs, pointer-up on sliders)
  const commit = useCallback(() => {
    clearTimeout(debounceRef.current);
    clearTimeout(holdRef.current);
    holdRef.current = undefined;
    if (localRef.current !== null && !inflightRef.current) {
      fire(localRef.current);
    }
  }, [fire]);

  // Abort pending changes without committing (e.g. pointer cancel)
  const reset = useCallback(() => {
    clearTimeout(debounceRef.current);
    clearTimeout(correctionRef.current);
    clearTimeout(holdRef.current);
    holdRef.current = undefined;
    localRef.current = null;
    setLocalValue(null);
    if (!inflightRef.current) {
      setPhase("idle");
    }
  }, []);

  // Cleanup — leave group if still inflight on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(safetyRef.current);
      clearTimeout(correctionRef.current);
      clearTimeout(holdRef.current);
      if (inflightRef.current) {
        groupRef.current?.leave();
      }
    };
  }, []);

  const displayValue = localValue ?? (frozenServerRef.current ?? serverValue);

  return { displayValue, phase, set, commit, reset };
}
