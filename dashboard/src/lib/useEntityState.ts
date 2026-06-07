import { useHass } from "@hakit/core";

/** Subscribe to a single entity's state string. Only re-renders when this entity changes. */
export function useEntityState(entityId: string): string | undefined {
  return useHass((s) => s.entities[entityId]?.state);
}
