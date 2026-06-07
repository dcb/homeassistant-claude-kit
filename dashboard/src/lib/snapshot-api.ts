/**
 * Snapshot listing and URL resolution via HA media_source WebSocket API.
 *
 * Snapshots are stored at /config/www/snapshots/{cameraId}/{YYYY-MM-DD}/{filename}.jpg
 * and exposed through media_source as media_source://media_source/local/snapshots/...
 *
 * Filename convention: {HH-MM-SS}_{source}.jpg
 * where source is one of the SnapshotSource values.
 */

import type { Connection } from "home-assistant-js-websocket";

export type SnapshotSource =
  | "person"
  | "motion"
  | "face"
  | "scheduled"
  | "stream"
  | "unknown";

export interface SnapshotEntry {
  filename: string;
  /** HH:MM:SS derived from filename */
  time: string;
  source: SnapshotSource;
  /** media_source media_id for URL resolution */
  mediaId: string;
}

interface MediaSourceItem {
  media_content_id: string;
  media_content_type: string;
  title: string;
  can_play: boolean;
  can_expand: boolean;
  thumbnail?: string;
  children?: MediaSourceItem[];
}

function parseSource(filename: string): SnapshotSource {
  const lower = filename.toLowerCase();
  if (lower.includes("person")) return "person";
  if (lower.includes("face")) return "face";
  if (lower.includes("motion")) return "motion";
  if (lower.includes("scheduled")) return "scheduled";
  if (lower.includes("stream")) return "stream";
  return "unknown";
}

function parseTime(filename: string): string {
  // Expects HH-MM-SS prefix in filename
  const match = filename.match(/^(\d{2})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}:${match[2]}:${match[3]}`;
  return "00:00:00";
}

async function browseMedia(
  connection: Connection,
  mediaContentId: string,
): Promise<MediaSourceItem[]> {
  try {
    const result = await connection.sendMessagePromise<{ children: MediaSourceItem[] }>({
      type: "media_source/browse_media",
      media_content_id: mediaContentId,
    });
    return result.children ?? [];
  } catch {
    return [];
  }
}

/**
 * Lists all snapshots for a given camera and date (YYYY-MM-DD).
 * Returns entries sorted chronologically (oldest first).
 */
export async function listSnapshots(
  connection: Connection,
  cameraId: string,
  dateStr: string,
): Promise<SnapshotEntry[]> {
  const mediaId = `media-source://media_source/local/snapshots/${cameraId}/${dateStr}`;
  const items = await browseMedia(connection, mediaId);

  return items
    .filter((item) => item.can_play && item.title.endsWith(".jpg"))
    .map((item) => {
      const filename = item.title;
      return {
        filename,
        time: parseTime(filename),
        source: parseSource(filename),
        mediaId: item.media_content_id,
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Resolves a media_source media_id to a playable URL.
 * Returns null if the media source doesn't support URL resolution.
 */
export async function resolveMediaUrl(
  connection: Connection,
  mediaId: string,
): Promise<string | null> {
  try {
    const result = await connection.sendMessagePromise<{ url: string }>({
      type: "media_source/resolve_media",
      media_content_id: mediaId,
    });
    return result.url ?? null;
  } catch {
    return null;
  }
}
