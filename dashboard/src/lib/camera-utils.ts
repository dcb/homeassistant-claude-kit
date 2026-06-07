/** Build a displayable image URL from a camera entity object. */
export function buildImageUrl(entity: Record<string, unknown> | undefined): string | null {
  if (!entity) return null;
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const path = (attrs?.entity_picture ?? attrs?.access_token) as string | undefined;
  if (!path) return null;
  // entity_picture is usually a relative path like /api/camera_proxy/camera.foo
  if (path.startsWith("/")) return path;
  return path;
}
