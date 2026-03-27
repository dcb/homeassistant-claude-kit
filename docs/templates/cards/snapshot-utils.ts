/**
 * Snapshot utility functions.
 *
 * Historical snapshot browsing now uses the media_source/browse_media API
 * (see snapshot-api.ts). This file only contains helper functions for
 * camera sorting and event detection using HA entity states.
 */

import type { HassEntities } from "home-assistant-js-websocket";

/**
 * Get the timestamp of the last person detection for a camera,
 * using the person sensor's last_changed attribute.
 *
 * Note: Eufy integration reconnects can cycle sensors through
 * unavailable→off, making last_changed unreliable for exact timing.
 * This is acceptable for camera sort order (not critical).
 */
export function getLastPersonTime(
  entities: HassEntities,
  personSensor: string,
): Date | null {
  const entity = entities[personSensor];
  if (!entity?.last_changed) return null;
  // Only count if the sensor has been "on" (person detected)
  // If it's currently "on", return now
  if (entity.state === "on") return new Date();
  return new Date(entity.last_changed);
}
