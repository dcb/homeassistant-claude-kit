import { useState, useEffect } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { CameraConfig } from "../../lib/entities";
import { parseNumericState } from "../../lib/format";
import { buildImageUrl } from "../../lib/camera-utils";

interface CameraCardProps {
  camera: CameraConfig;
  snapshotVersion?: number;
  onTap: () => void;
}

export function CameraCard({ camera, snapshotVersion = 0, onTap }: CameraCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [eventImgFailed, setEventImgFailed] = useState(false);
  const [snapshotMtime, setSnapshotMtime] = useState<number | null>(null);

  useEffect(() => { setSnapshotFailed(false); }, [snapshotVersion]);

  const battery = parseNumericState(
    entities[camera.batterySensor]?.state,
  );

  const imageEntity = entities[camera.eventImage];
  const eventImageUrl = buildImageUrl(imageEntity);

  // Fetch snapshot file's Last-Modified via HEAD request
  useEffect(() => {
    let cancelled = false;
    fetch(`/local/snapshots/${camera.id}.jpg?_h=${Date.now()}`, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        const lm = res.headers.get("Last-Modified");
        if (!cancelled && lm) setSnapshotMtime(new Date(lm).getTime());
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [camera.id, snapshotVersion]);

  // Thumbnail age from actual file modification time
  const thumbnailAge = snapshotMtime !== null
    ? Math.floor((Date.now() - snapshotMtime) / 60_000)
    : null;
  const ageLabel =
    thumbnailAge === null
      ? null
      : thumbnailAge < 5
        ? "now"
        : thumbnailAge < 60
          ? `${thumbnailAge}m`
          : thumbnailAge < 1440
            ? `${Math.floor(thumbnailAge / 60)}h`
            : `${Math.floor(thumbnailAge / 1440)}d`;
  const ageStale = thumbnailAge !== null && thumbnailAge > 120; // >2h = stale
  // Cache-bust with file mtime (reflects both stream and motion snapshots)
  const cacheBuster = snapshotMtime ?? snapshotVersion;
  const snapshotUrl = `/local/snapshots/${camera.id}.jpg?_t=${cacheBuster}`;
  const imageUrl = !snapshotFailed
    ? snapshotUrl
    : !eventImgFailed && eventImageUrl
      ? eventImageUrl
      : null;

  const batteryColor =
    battery === null
      ? "text-text-dim"
      : battery < 20
        ? "text-accent-red"
        : battery < 50
          ? "text-accent-warm"
          : "text-accent-green";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onTap}
      className="contain-card relative flex flex-col overflow-hidden rounded-2xl bg-bg-card text-left transition-colors hover:bg-bg-elevated active:bg-bg-elevated"
    >
      {/* Snapshot / event image */}
      <div className="relative aspect-video w-full bg-black/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={camera.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              if (!snapshotFailed) setSnapshotFailed(true);
              else setEventImgFailed(true);
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon icon="mdi:camera-off" width={32} className="text-text-dim" />
          </div>
        )}

        {/* Battery overlay — top right */}
        {battery !== null && (
          <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-xs backdrop-blur-sm">
            <Icon icon="mdi:battery" width={12} className={batteryColor} />
            <span className={`tabular-nums ${batteryColor}`}>
              {Math.round(battery)}%
            </span>
          </div>
        )}

        {/* Thumbnail age — bottom left */}
        {ageLabel && (
          <div className={`absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-xs backdrop-blur-sm ${
            ageStale ? "text-accent-warm" : "text-text-dim"
          }`}>
            <Icon icon="mdi:clock-outline" width={10} />
            <span className="tabular-nums">{ageLabel}</span>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="px-3 py-2">
        <span className="text-sm font-medium">{camera.name}</span>
      </div>
    </motion.button>
  );
}
