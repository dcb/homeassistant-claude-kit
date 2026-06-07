// useControlGroup.ts — coordinates multiple controls on the same entity
import { useRef, useCallback, useMemo } from "react";

export interface ControlGroup {
  /** True when any member is inflight */
  busyRef: React.RefObject<boolean>;
  /** Called when a member enters inflight */
  enter: () => void;
  /** Called when a member leaves inflight */
  leave: () => void;
}

/**
 * Creates a control group for coordinating multiple useControlCommit hooks
 * on the same entity. When any member is inflight, idle siblings freeze their
 * display values to prevent flicker from intermediate entity updates.
 */
export function useControlGroup(): ControlGroup {
  const countRef = useRef(0);
  const busyRef = useRef(false);

  const enter = useCallback(() => {
    countRef.current++;
    busyRef.current = true;
  }, []);

  const leave = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      busyRef.current = false;
    }
  }, []);

  return useMemo(() => ({ busyRef, enter, leave }), [busyRef, enter, leave]);
}
