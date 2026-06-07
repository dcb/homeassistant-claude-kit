import { useRef } from "react";

/**
 * Opaque token passed to useControlCommit/useSliderControl siblings on the same entity.
 * When any sibling enters inflight, all others freeze their display values so they
 * don't flicker back to server state mid-flight.
 */
export interface ControlGroup {
  /** True while any member of this group has an in-flight request. */
  isInflight: () => boolean;
  /** Called by a member when it enters inflight. */
  setInflight: (on: boolean) => void;
}

export function useControlGroup(): ControlGroup {
  const inflightCount = useRef(0);

  const groupRef = useRef<ControlGroup>({
    isInflight: () => inflightCount.current > 0,
    setInflight: (on) => {
      inflightCount.current = Math.max(0, inflightCount.current + (on ? 1 : -1));
    },
  });

  return groupRef.current;
}
