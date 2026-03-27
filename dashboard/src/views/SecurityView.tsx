import { useState, useMemo } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { CAMERAS, GATE_LOCK, NIGHT_ALERTS, DOORBELL_RINGING } from "../lib/entities";
import type { CameraConfig } from "../lib/entities";
import { getLastPersonTime } from "../lib/snapshot-utils";
import { CameraCard } from "../components/cards/CameraCard";
import { CameraPopup } from "../components/popups/CameraPopup";
import { RecentEvents } from "../components/cards/RecentEvents";

/**
 * Sort cameras: doorbell always first, rest by most recent person detection.
 */
function sortCameras(entities: HassEntities): CameraConfig[] {
  const doorbell = CAMERAS.find((c) => c.id === "doorbell");
  const rest = CAMERAS.filter((c) => c.id !== "doorbell");

  rest.sort((a, b) => {
    const aTime = getLastPersonTime(entities, a.personSensor);
    const bTime = getLastPersonTime(entities, b.personSensor);
    return (bTime?.getTime() ?? 0) - (aTime?.getTime() ?? 0);
  });

  return doorbell ? [doorbell, ...rest] : rest;
}

export function SecurityView() {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const [selectedCamera, setSelectedCamera] = useState<CameraConfig | null>(
    null,
  );
  const [snapshotVersions, setSnapshotVersions] = useState<
    Record<string, number>
  >({});

  const sortedCameras = useMemo(() => sortCameras(entities), [entities]);

  const gateLocked = entities[GATE_LOCK]?.state !== "on";
  const nightAlertsOn = entities[NIGHT_ALERTS]?.state === "on";

  const unlockGate = () => {
    if (!connection) return;
    callService(connection, "switch", "turn_on", undefined, {
      entity_id: GATE_LOCK,
    });
  };

  const toggleNightAlerts = () => {
    if (!connection) return;
    callService(connection, "input_boolean", "toggle", undefined, {
      entity_id: NIGHT_ALERTS,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* Gate Lock */}
      <button
        onClick={unlockGate}
        className={`flex w-full items-center justify-between rounded-2xl p-4 transition-colors ${
          gateLocked
            ? "bg-bg-card hover:bg-bg-elevated"
            : "bg-accent-green/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon
            icon={gateLocked ? "mdi:gate" : "mdi:gate-open"}
            width={28}
            className={gateLocked ? "text-text-secondary" : "text-accent-green"}
          />
          <div className="text-left">
            <h2 className="text-sm font-medium">Gate</h2>
            <p className="text-xs text-text-dim">
              {gateLocked ? "Locked" : "Unlocked"}
            </p>
          </div>
        </div>
        <div
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            gateLocked
              ? "bg-accent/20 text-accent"
              : "bg-accent-green/30 text-accent-green"
          }`}
        >
          <Icon icon="mdi:lock-open-variant" width={18} />
        </div>
      </button>

      {/* Camera Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sortedCameras.map((camera) => (
          <CameraCard
            key={camera.id}
            camera={camera}
            snapshotVersion={snapshotVersions[camera.id] ?? 0}
            onTap={() => setSelectedCamera(camera)}
          />
        ))}
      </div>

      {/* Night Alerts Toggle */}
      <button
        onClick={toggleNightAlerts}
        className="flex w-full items-center justify-between rounded-2xl bg-bg-card p-4 transition-colors hover:bg-bg-elevated"
      >
        <div className="flex items-center gap-3">
          <Icon
            icon="mdi:shield-moon"
            width={22}
            className={nightAlertsOn ? "text-accent" : "text-text-dim"}
          />
          <div className="text-left">
            <span className="text-sm font-medium">Night Alerts</span>
            <p className="text-xs text-text-dim">
              Interior person detection after dark
            </p>
          </div>
        </div>
        <div
          className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
            nightAlertsOn ? "bg-accent" : "bg-white/10"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              nightAlertsOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </button>

      {/* Recent Events */}
      <RecentEvents cameras={CAMERAS} doorbellEntity={DOORBELL_RINGING} onCameraTap={setSelectedCamera} />

      {/* Camera Popup */}
      <CameraPopup
        camera={selectedCamera}
        open={selectedCamera !== null}
        onClose={() => setSelectedCamera(null)}
        gateLockEntity={GATE_LOCK}
        onSnapshot={(cameraId) =>
          setSnapshotVersions((v) => ({
            ...v,
            [cameraId]: (v[cameraId] ?? 0) + 1,
          }))
        }
      />
    </div>
  );
}
