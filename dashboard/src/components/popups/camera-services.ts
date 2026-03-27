import { SNAPSHOT_SAVE_CAMERA } from "../../lib/entities";

const HA_TOKEN = import.meta.env.VITE_HA_TOKEN as string | undefined;

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (HA_TOKEN) h["Authorization"] = `Bearer ${HA_TOKEN}`;
  return h;
}

/** Call an HA service via REST API. Returns true if the call succeeded (2xx). */
export async function callServiceRest(
  domain: string,
  service: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/services/${domain}/${service}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fire-and-forget variant -- for stop calls and snapshot saves where we don't need the result */
export function fireServiceRest(
  domain: string,
  service: string,
  data: Record<string, unknown>,
) {
  fetch(`/api/services/${domain}/${service}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  }).catch(() => {});
}

/**
 * Trigger a snapshot save via shell_command and call back when it's likely done.
 * The shell command takes ~3-5s to grab a frame from go2rtc and save to disk.
 *
 * Pipeline: writes to input_text.snapshot_save_camera →
 * automation reads it → shell_command.copy_stream_snapshot runs →
 * saves to /media/snapshots/. Both the helper and automation must exist in HA.
 *
 * Do NOT call this function to health-check battery cameras. It initiates a go2rtc
 * P2P stream session, which wakes the camera and drains battery.
 */
export function triggerSnapshot(
  cameraId: string,
  cancelled: boolean,
  onDone: () => void,
) {
  fireServiceRest("input_text", "set_value", {
    entity_id: SNAPSHOT_SAVE_CAMERA,
    value: cameraId,
  });
  setTimeout(() => {
    if (cancelled) return;
    fireServiceRest("shell_command", "copy_stream_snapshot", {});
    // Wait for the shell command to complete before signaling done
    setTimeout(() => onDone(), 5000);
  }, 300);
}

/**
 * Module-level map of pending stop timers by camera entity.
 * When a popup closes, we delay the stop call so that quick reopen can cancel it.
 * Must be module-level (not instance-level ref) because close unmounts the old
 * CameraContent and reopen creates a NEW instance -- instance refs don't survive.
 */
export const pendingStopTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Module-level map of camera entity → timestamp of last start attempt.
 * Prevents React strict mode double-effect from sending duplicate start_p2p
 * calls, which causes the addon to return "already_running" errors.
 * Uses timestamps instead of a Set because strict mode cleanup runs between
 * mount and remount, which would clear a Set-based guard too early.
 */
export const startingStreams = new Map<string, number>();
