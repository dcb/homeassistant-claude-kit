import type { HassEntity } from "home-assistant-js-websocket";

/**
 * Build a cache-busted image URL from an HA image entity.
 *
 * The entity_picture attribute contains a signed URL like:
 *   /api/image_proxy/image.doorbell_event_image?token=xxx
 *
 * The token is static (doesn't change on new events), so we append
 * `last_updated` as a cache buster to force the browser to refetch
 * when a new event image arrives.
 *
 * Returns null if the entity doesn't exist or has no entity_picture.
 */
export function buildImageUrl(entity: HassEntity | undefined): string | null {
  if (!entity) return null;

  const entityPicture = entity.attributes?.entity_picture as
    | string
    | undefined;
  if (!entityPicture) return null;

  // Append last_updated as cache buster
  const cacheBuster = entity.last_updated
    ? `&_t=${new Date(entity.last_updated).getTime()}`
    : "";

  return `${entityPicture}${cacheBuster}`;
}
