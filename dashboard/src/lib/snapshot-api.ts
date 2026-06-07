/**
 * Snapshot browsing API using HA's media_source/browse_media WebSocket.
 *
 * Snapshots are stored at /media/snapshots/YYYY/MM/camera_id/YYYYMMDD_HHMMSS_source.jpg
 * The media source prefix is: media-source://media_source/local/snapshots/
 */

import type { Connection } from "home-assistant-js-websocket";

const MEDIA_PREFIX = "media-source://media_source/local/snapshots";

export type SnapshotSource = "person" | "motion" | "face" | "scheduled" | "stream" | "unknown";

export interface SnapshotEntry {
  filename: string;
  time: string; // "HH:MM:SS"
  timestamp: Date;
  source: SnapshotSource;
  mediaId: string;
}

interface BrowseMediaChild {
  title: string;
  media_class: string;
  media_content_id: string;
  media_content_type: string | null;
  can_play: boolean;
  can_expand: boolean;
  thumbnail: string | null;
  children_media_class: string | null;
}

interface BrowseMediaResult {
  title: string;
  media_class: string;
  media_content_id: string;
  can_expand: boolean;
  children: BrowseMediaChild[];
}

/**
 * List subdirectories (years, months, or camera IDs) at a given path.
 * Returns an array of directory names.
 */
export async function listMediaDirs(
  connection: Connection,
  path: string = "",
): Promise<string[]> {
  const mediaId = path ? `${MEDIA_PREFIX}/${path}` : MEDIA_PREFIX;
  try {
    const result = await connection.sendMessagePromise<BrowseMediaResult>({
      type: "media_source/browse_media",
      media_content_id: mediaId,
    });
    return (result.children ?? [])
      .filter((c) => c.can_expand) // directories only
      .map((c) => c.title);
  } catch {
    return [];
  }
}

/**
 * List snapshot files for a specific camera on a specific date.
 *
 * @param connection - HA WebSocket connection
 * @param cameraId - Camera ID (e.g. "doorbell")
 * @param date - Date string "YYYY-MM-DD"
 * @returns Sorted array of SnapshotEntry (newest first)
 */
export async function listSnapshots(
  connection: Connection,
  cameraId: string,
  date: string,
): Promise<SnapshotEntry[]> {
  const [year, month] = date.split("-");
  const datePrefix = date.replace(/-/g, ""); // "20260311"
  const mediaPath = `${year}/${month}/${cameraId}`;
  const mediaId = `${MEDIA_PREFIX}/${mediaPath}`;

  try {
    const result = await connection.sendMessagePromise<BrowseMediaResult>({
      type: "media_source/browse_media",
      media_content_id: mediaId,
    });

    const snapshots: SnapshotEntry[] = [];
    for (const child of result.children ?? []) {
      if (child.can_expand || !child.title.endsWith(".jpg")) continue;
      // Only include files matching the requested date
      if (!child.title.startsWith(datePrefix)) continue;

      const parsed = parseSnapshotFilename(child.title);
      if (parsed) {
        snapshots.push({ ...parsed, mediaId: child.media_content_id });
      }
    }

    // Sort newest first
    snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return snapshots;
  } catch {
    return [];
  }
}

/**
 * List all snapshots for ALL cameras on a specific date.
 * Browses each camera's month folder and filters by date prefix.
 */
export async function listAllSnapshotsForDate(
  connection: Connection,
  date: string,
): Promise<Map<string, SnapshotEntry[]>> {
  const [year, month] = date.split("-");
  const monthPath = `${year}/${month}`;

  // Get list of camera folders in this month
  const cameraIds = await listMediaDirs(connection, monthPath);

  // Fetch snapshots for each camera in parallel
  const results = new Map<string, SnapshotEntry[]>();
  const promises = cameraIds.map(async (camId) => {
    const snaps = await listSnapshots(connection, camId, date);
    if (snaps.length > 0) {
      results.set(camId, snaps);
    }
  });
  await Promise.all(promises);

  return results;
}

/**
 * Get available dates that have snapshots, derived from the year/month directory structure.
 * Returns months as "YYYY-MM" strings (we can't know exact days without listing files).
 */
export async function listAvailableMonths(
  connection: Connection,
): Promise<string[]> {
  const years = await listMediaDirs(connection, "");
  const months: string[] = [];

  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue;
    const monthDirs = await listMediaDirs(connection, year);
    for (const month of monthDirs) {
      if (/^\d{2}$/.test(month)) {
        months.push(`${year}-${month}`);
      }
    }
  }

  return months.sort().reverse();
}

/**
 * Resolve a media content ID to an accessible URL.
 */
export async function resolveMediaUrl(
  connection: Connection,
  mediaContentId: string,
): Promise<string | null> {
  try {
    const result = await connection.sendMessagePromise<{ url: string; mime_type: string }>({
      type: "media_source/resolve_media",
      media_content_id: mediaContentId,
    });
    return result.url;
  } catch {
    return null;
  }
}

// --- Internal helpers ---

function parseSnapshotFilename(
  filename: string,
): Omit<SnapshotEntry, "mediaId"> | null {
  // Format: YYYYMMDD_HHMMSS_source.jpg
  const match = filename.match(
    /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_(person|motion|face|scheduled|stream))?\.jpg$/,
  );
  if (!match) return null;

  const [, y, mo, d, h, mi, s, src] = match;
  const source: SnapshotSource = (src as SnapshotSource) ?? "unknown";
  const timestamp = new Date(+y, +mo - 1, +d, +h, +mi, +s);

  return {
    filename,
    time: `${h}:${mi}:${s}`,
    timestamp,
    source,
  };
}
