/**
 * Get the best entity picture URL from HA entity attributes.
 *
 * Prefers `entity_picture_local` (always a relative HA path, no cert issues)
 * over `entity_picture` (may be an absolute https:// URL).
 *
 * Returns `{ src, fallback? }` — use `fallback` as `data-fallback` on the
 * <img> so `entityPictureOnError` can try it before the https→http retry.
 */
export function getEntityPicture(
  attributes: Record<string, unknown> | undefined,
): { src: string; fallback?: string } | undefined {
  if (!attributes) return undefined;

  const local = attributes.entity_picture_local as string | undefined;
  const remote = normalizeUrl(attributes.entity_picture as string | undefined);

  if (local && remote) return { src: local, fallback: remote };
  if (local) return { src: local };
  if (remote) return { src: remote };
  return undefined;
}

function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith("http")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/")) {
      return parsed.pathname + parsed.search;
    }
  } catch {
    // malformed URL, return as-is
  }
  return url;
}

/**
 * onError handler for entity_picture <img> tags.
 * Fallback chain: data-fallback URL → https→http retry.
 */
export function entityPictureOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;

  // Try the fallback URL first (entity_picture when entity_picture_local failed)
  const fallback = img.dataset.fallback;
  if (fallback) {
    img.src = fallback;
    delete img.dataset.fallback; // only try once
    return;
  }

  // Last resort: https → http
  if (img.src.startsWith("https://")) {
    img.src = img.src.replace("https://", "http://");
  }
}
