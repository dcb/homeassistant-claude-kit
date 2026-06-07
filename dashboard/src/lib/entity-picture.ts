export interface EntityPicture {
  src: string;
  fallback?: string;
}

export function getEntityPicture(
  attributes: Record<string, unknown>,
): EntityPicture | null {
  const pic = attributes?.entity_picture as string | undefined;
  if (!pic) return null;
  return { src: pic };
}

export function entityPictureOnError(e: React.SyntheticEvent<HTMLImageElement>): void {
  e.currentTarget.src = "";
  e.currentTarget.style.display = "none";
}
