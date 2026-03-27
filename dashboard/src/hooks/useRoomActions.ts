import { useHass } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import type { RoomConfig } from "../lib/areas";
import { useControlCommit, type Phase } from "../lib/useControlCommit";

/**
 * Shared toggle handlers for room quick-action buttons.
 * Used by both RoomCard (inline status chips) and QuickActions (popup).
 */
export function useRoomActions(
  room: RoomConfig,
  state: {
    lightsOn: number;
    coversOpen: number;
    activeMedia: string | undefined;
    mediaState: string | undefined;
    isMuted: boolean | undefined;
  },
) {
  const connection = useHass((s) => s.connection);

  const lightsControl = useControlCommit<boolean>(
    state.lightsOn > 0,
    (on) => {
      if (!connection) return;
      const service = on ? "turn_on" : "turn_off";
      room.lights.forEach((id) => {
        const domain = id.split(".")[0];
        callService(connection, domain, service, {}, { entity_id: id });
      });
    },
    { debounceMs: 200 },
  );

  const coversControl = useControlCommit<boolean>(
    state.coversOpen > 0,
    (open) => {
      if (!connection || !room.covers?.length) return;
      const service = open ? "open_cover" : "close_cover";
      room.covers.forEach((id) => {
        callService(connection, "cover", service, {}, { entity_id: id });
      });
    },
    { debounceMs: 200 },
  );

  const mediaControl = useControlCommit<boolean>(
    state.mediaState === "playing",
    () => {
      if (!connection || !state.activeMedia) return;
      callService(connection, "media_player", "media_play_pause", {}, { entity_id: state.activeMedia });
    },
    { debounceMs: 200 },
  );

  const muteControl = useControlCommit<boolean>(
    state.isMuted ?? false,
    (muted) => {
      if (!connection || !state.activeMedia) return;
      callService(connection, "media_player", "volume_mute", { is_volume_muted: muted }, { entity_id: state.activeMedia });
    },
    { debounceMs: 200 },
  );

  const toggleLights = () => {
    if (lightsControl.phase !== "idle") return;
    lightsControl.set(state.lightsOn === 0);
    lightsControl.commit();
  };

  const toggleCovers = () => {
    if (!room.covers?.length || coversControl.phase !== "idle") return;
    coversControl.set(state.coversOpen === 0);
    coversControl.commit();
  };

  const togglePlayback = () => {
    if (!state.activeMedia || mediaControl.phase !== "idle") return;
    mediaControl.set(state.mediaState !== "playing");
    mediaControl.commit();
  };

  const toggleMute = () => {
    if (!state.activeMedia || muteControl.phase !== "idle") return;
    muteControl.set(!(state.isMuted ?? false));
    muteControl.commit();
  };

  return {
    toggleLights,
    toggleCovers,
    togglePlayback,
    toggleMute,
    lightsPhase: lightsControl.phase as Phase,
    coversPhase: coversControl.phase as Phase,
    mediaPhase: mediaControl.phase as Phase,
    mutePhase: muteControl.phase as Phase,
  };
}
