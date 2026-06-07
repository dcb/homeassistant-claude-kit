import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";

/**
 * Returns the current state string for an entity, or undefined if the entity
 * is not found or the connection is not ready.
 */
export function useEntityState(entityId: string): string | undefined {
  return useHass((s) => (s.entities as HassEntities)[entityId]?.state);
}
