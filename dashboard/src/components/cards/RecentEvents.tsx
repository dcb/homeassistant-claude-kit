import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { useMultiStateHistory } from "../../hooks/useHistory";
import type { CameraConfig } from "../../lib/entities";

interface SecurityEvent {
  time: Date;
  camera: CameraConfig | null;
  cameraName: string;
  type: "person" | "doorbell";
}

interface RecentEventsProps {
  cameras: CameraConfig[];
  doorbellEntity: string;
  onCameraTap: (camera: CameraConfig) => void;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function RecentEvents({ cameras, doorbellEntity, onCameraTap }: RecentEventsProps) {
  const eventSensors = useMemo(
    () => [...cameras.map((c) => c.personSensor), doorbellEntity],
    [cameras, doorbellEntity],
  );

  const sensorToCamera = useMemo(() => {
    const map = new Map<string, CameraConfig>();
    for (const cam of cameras) {
      map.set(cam.personSensor, cam);
    }
    const doorbellCam = cameras.find((c) => c.id === "doorbell");
    if (doorbellCam) map.set(doorbellEntity, doorbellCam);
    return map;
  }, [cameras, doorbellEntity]);

  // Stable start time: recomputed only when sensors change (avoids re-subscriptions)
  const startTime = useMemo(
    () => new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventSensors.join(",")],
  );

  const history = useMultiStateHistory(eventSensors, startTime);

  const events = useMemo(() => {
    const parsed: SecurityEvent[] = [];

    for (const entityId of eventSensors) {
      const entries = history[entityId];
      if (!entries || entries.length === 0) continue;

      const isDoorbell = entityId === doorbellEntity;
      const cam = sensorToCamera.get(entityId) ?? null;

      for (const entry of entries) {
        if (entry.state !== "on") continue;

        parsed.push({
          time: new Date(entry.time),
          camera: cam,
          cameraName: isDoorbell
            ? "Doorbell"
            : (cam?.name ?? entityId),
          type: isDoorbell ? "doorbell" : "person",
        });
      }
    }

    parsed.sort((a, b) => b.time.getTime() - a.time.getTime());
    return parsed.slice(0, 30);
  }, [history, eventSensors, doorbellEntity, sensorToCamera]);

  const hasData = Object.keys(history).length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl bg-bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">
          Recent Events
        </h2>
        <p className="text-xs text-text-dim">Loading...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">
          Recent Events
        </h2>
        <p className="text-xs text-text-dim">No events in the last 24h</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 text-sm font-medium text-text-secondary">
        Recent Events
      </h2>
      <div className="space-y-1">
        {events.map((event, i) => (
          <button
            key={`${event.time.getTime()}-${i}`}
            onClick={() => event.camera && onCameraTap(event.camera)}
            disabled={!event.camera}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-bg-elevated active:bg-bg-elevated disabled:opacity-50"
          >
            {/* Snapshot thumbnail */}
            <EventThumbnail camera={event.camera} type={event.type} />

            {/* Camera name + event type */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text-primary">
                {event.cameraName}
              </div>
              <div className="text-xs text-text-dim">
                {event.type === "doorbell"
                  ? "Doorbell ring"
                  : "Person detected"}
              </div>
            </div>

            {/* Time */}
            <span className="shrink-0 text-xs tabular-nums text-text-dim">
              {formatEventTime(event.time)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EventThumbnail({
  camera,
  type,
}: {
  camera: CameraConfig | null;
  type: "person" | "doorbell";
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!camera || imgFailed) {
    return (
      <div
        className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg ${
          type === "doorbell" ? "bg-accent-warm/15" : "bg-accent/15"
        }`}
      >
        <Icon
          icon={type === "doorbell" ? "mdi:doorbell" : "mdi:account-alert"}
          width={18}
          className={
            type === "doorbell" ? "text-accent-warm" : "text-accent"
          }
        />
      </div>
    );
  }

  return (
    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-black/30">
      <img
        src={`/local/snapshots/${camera.id}.jpg?_t=${Math.floor(Date.now() / 300_000)}`}
        alt={camera.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    </div>
  );
}

function formatEventTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 12) return `${diffHrs}h ago`;

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
