import { useState, useEffect } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import * as Dialog from "@radix-ui/react-dialog";
import type { RoomConfig } from "../../lib/areas";
import {
  getAdapter,
  type TvAdapter,
  type AppDefinition,
  type RemoteAction,
} from "../../lib/tv-adapter";
import { useControlCommit } from "../../lib/useControlCommit";
import { useControlGroup } from "../../lib/useControlGroup";
import { useSliderControl } from "../../lib/useSliderControl";
import { IconButton } from "../controls/IconButton";
import { SliderTrack } from "../controls/SliderTrack";
import { Touchpad } from "../controls/Touchpad";
import { AppStrip } from "../controls/AppStrip";
import { SeekBar } from "../controls/SeekBar";
import { PopoverSelect } from "../controls/PopoverSelect";
import { getEntityPicture, entityPictureOnError } from "../../lib/entity-picture";
import { BottomSheet } from "./BottomSheet";

interface RemotePopupProps {
  room: RoomConfig;
  mediaPlayerId: string;
  open: boolean;
  onClose: () => void;
  entities: HassEntities;
}

const SLEEP_ITEMS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "cancel", label: "Cancel timer" },
];

export function RemotePopup({
  room,
  mediaPlayerId,
  open,
  onClose,
  entities,
}: RemotePopupProps) {
  const connection = useHass((s) => s.connection);
  const [adapter, setAdapter] = useState<TvAdapter | null>(null);

  const isTvMode = !!room.remoteEntity && !!room.tvPlatform;

  // Load adapter for TV mode only
  useEffect(() => {
    if (!room.tvPlatform) return;
    getAdapter(room.tvPlatform).then(setAdapter);
  }, [room.tvPlatform]);

  const entity = entities[mediaPlayerId];
  const name =
    (entity?.attributes?.friendly_name as string) ?? mediaPlayerId;
  const state = entity?.state;
  const isPlaying = state === "playing";
  const features = (entity?.attributes?.supported_features as number) ?? 0;

  // Media info
  const title = entity?.attributes?.media_title as string | undefined;
  const artist = entity?.attributes?.media_artist as string | undefined;
  const picture = getEntityPicture(entity?.attributes as Record<string, unknown>);
  const source = entity?.attributes?.source as string | undefined;

  // Seek data
  const mediaDuration = entity?.attributes?.media_duration as number | undefined;
  const mediaPosition = entity?.attributes?.media_position as number | undefined;
  const positionUpdatedAt = entity?.attributes?.media_position_updated_at as string | undefined;
  const canSeek = (features & 2) !== 0;

  // Volume targets explicit volumeEntity, or first active volume-capable player
  const volumePlayerId =
    room.volumeEntity ??
    room.mediaPlayers?.find((id) => {
      const e = entities[id];
      return (
        e != null &&
        e.state !== "off" &&
        e.state !== "unavailable" &&
        e.attributes?.volume_level != null &&
        (((e.attributes?.supported_features as number) ?? 0) & 4) !== 0
      );
    }) ??
    mediaPlayerId;
  const volumeEntity = entities[volumePlayerId];
  const volume = volumeEntity?.attributes?.volume_level as number | undefined;
  const isMuted = volumeEntity?.attributes?.is_volume_muted as boolean | undefined;
  const volumeFeatures =
    (volumeEntity?.attributes?.supported_features as number) ?? 0;
  const canVolumeSet = (volumeFeatures & 4) !== 0;
  const canVolumeMute = (volumeFeatures & 8) !== 0;

  // Sleep timer (TV mode only)
  const timerEntity = room.sleepTimer ? entities[room.sleepTimer] : undefined;
  const timerActive = timerEntity?.state === "active";

  // Current app from adapter (TV mode only)
  const activeApp =
    isTvMode && adapter
      ? adapter.getCurrentApp(entities, room.remoteEntity!, mediaPlayerId)
      : undefined;

  // --- Control group: coordinates all controls sharing entities ---
  const group = useControlGroup();

  // --- Mute (shares volume entity with slider) ---
  const muteControl = useControlCommit<boolean>(isMuted ?? false, (muted) => {
    if (!connection) return;
    callService(connection, "media_player", "volume_mute", { is_volume_muted: muted }, { entity_id: volumePlayerId }).catch(() => {});
  }, { debounceMs: 0, group });

  // --- Play/pause (audio mode only — TV mode is fire-and-forget via sendCommand) ---
  const playControl = useControlCommit<boolean>(isPlaying, (playing) => {
    if (!connection) return;
    callService(connection, "media_player", playing ? "media_play" : "media_pause", {}, { entity_id: mediaPlayerId }).catch(() => {});
  }, { debounceMs: 0, group });

  // --- Volume slider (shares volume entity with mute) ---
  const commitVolume = (pct: number) => {
    if (!connection) return;
    callService(connection, "media_player", "volume_set", { volume_level: pct / 100 }, { entity_id: volumePlayerId }).catch(() => {});
  };
  const slider = useSliderControl(
    Math.round((volume ?? 0) * 100),
    commitVolume,
    { min: 0, max: 100, step: 1, group },
  );

  // --- Fire-and-forget actions (no server value to track) ---

  const sendCommand = (action: RemoteAction) => {
    if (!connection || !adapter || !room.remoteEntity) return;
    callService(
      connection,
      "remote",
      "send_command",
      { command: adapter.keyCode(action) },
      { entity_id: room.remoteEntity },
    ).catch(() => {});
  };

  const launchApp = (app: AppDefinition) => {
    if (!connection || !adapter) return;
    const call = adapter.launchApp(app, mediaPlayerId);
    callService(connection, call.domain, call.service, call.data, call.target).catch(() => {});
  };

  const handleSleep = (value: string) => {
    if (!connection || !room.sleepTimer) return;
    if (value === "cancel") {
      callService(connection, "timer", "cancel", {}, { entity_id: room.sleepTimer }).catch(() => {});
    } else {
      const mins = parseInt(value);
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      callService(connection, "timer", "start", { duration: `${hh}:${mm}:00` }, { entity_id: room.sleepTimer }).catch(() => {});
    }
  };

  const powerOff = () => {
    if (!connection) return;
    if (isTvMode && room.remoteEntity) {
      callService(connection, "remote", "turn_off", {}, { entity_id: room.remoteEntity }).catch(() => {});
    } else {
      callService(connection, "media_player", "turn_off", {}, { entity_id: mediaPlayerId }).catch(() => {});
    }
    onClose();
  };

  // Audio mode transport (prev/next are fire-and-forget)
  const callMedia = (service: string) => {
    if (!connection) return;
    callService(connection, "media_player", service, {}, { entity_id: mediaPlayerId }).catch(() => {});
  };

  const handleSeek = (seconds: number) => {
    if (!connection) return;
    callService(connection, "media_player", "media_seek", { seek_position: seconds }, { entity_id: mediaPlayerId }).catch(() => {});
  };

  // TV mode waits for adapter to load
  if (isTvMode && !adapter) return null;

  // --- Transport buttons (differ by mode) ---
  // Always show when popup is open — transient state changes (e.g. "buffering"
  // during seek) must not unmount controls and cause layout shifts
  const showTransport = state != null && state !== "off" && state !== "unavailable";

  // TV mode: adapter-driven visibility
  const tvHasPrev = adapter?.supportedActions.has("previous") ?? false;
  const tvHasNext = adapter?.supportedActions.has("next") ?? false;
  const tvHasRew = adapter?.supportedActions.has("rewind") ?? false;
  const tvHasFfw = adapter?.supportedActions.has("fast_forward") ?? false;

  // Audio mode: entity feature flags
  const audioHasPlayPause = (features & 1) !== 0;
  const audioHasPrev = (features & 16) !== 0;
  const audioHasNext = (features & 32) !== 0;

  const hasVolumeRow = canVolumeSet && volume != null;

  return (
    <BottomSheet open={open} onClose={onClose} className="md:max-w-lg flex flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col p-5 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              {isTvMode && activeApp && (
                <Icon icon={activeApp.icon} width={16} style={{ color: activeApp.color }} className="shrink-0" />
              )}
              <Dialog.Title className="text-[15px] font-semibold leading-tight">
                {name}
              </Dialog.Title>
            </div>
            <Dialog.Description className="sr-only">
              {isTvMode ? "Remote control" : "Media player"} for {name}
            </Dialog.Description>
            {!isTvMode && source && (
              <div className="mt-0.5 text-[10px] text-text-dim">{source}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isTvMode && room.sleepTimer && (
              <PopoverSelect
                items={SLEEP_ITEMS}
                value={undefined}
                onSelect={handleSleep}
                trigger={
                  <button className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-text-dim hover:bg-white/10">
                    <Icon icon="mdi:moon-waning-crescent" width={18} />
                    {timerActive && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
                    )}
                  </button>
                }
                side="bottom"
                align="end"
              />
            )}
            <IconButton
              icon="mdi:power"
              className="text-accent-green"
              onClick={powerOff}
            />
          </div>
        </div>

        {/* Content — centered vertically in remaining space */}
        <div className="flex min-h-0 flex-1 flex-col justify-center space-y-4 py-4">
          {/* === TV REMOTE MODE === */}
          {isTvMode && (
            <>
              {/* App strip */}
              <AppStrip activeApp={activeApp} onLaunch={launchApp} />

              {/* Touchpad */}
              <Touchpad onAction={sendCommand} />

              {/* System buttons */}
              <div className="flex justify-center gap-6">
                {(["back", "home", "menu"] as const).map((action) => (
                  <button
                    key={action}
                    onClick={() => sendCommand(action)}
                    className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/4 text-text-dim active:bg-white/10"
                  >
                    <Icon
                      icon={
                        action === "back" ? "mdi:arrow-left"
                        : action === "home" ? "mdi:circle-outline"
                        : "mdi:menu"
                      }
                      width={16}
                    />
                    <span className="text-[7px] uppercase tracking-wide">{action}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* === AUDIO PLAYER MODE === */}
          {!isTvMode && (
            <>
              {/* Cover art */}
              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-bg-elevated">
                {picture ? (
                  <img src={picture.src} data-fallback={picture.fallback} alt="" className="h-full w-full object-cover" onError={entityPictureOnError} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-linear-to-br from-bg-elevated to-bg-card">
                    <Icon icon="mdi:music-note" width={48} className="text-white/20" />
                  </div>
                )}
              </div>

              {/* Track info */}
              {title && (
                <div className="text-center">
                  <div className="text-sm font-semibold">{title}</div>
                  {artist && <div className="text-xs text-text-dim">{artist}</div>}
                </div>
              )}
            </>
          )}

          {/* === SHARED SECTIONS === */}

          {/* Seek bar */}
          {mediaDuration != null && mediaDuration > 0 && (
            <SeekBar
              position={mediaPosition ?? 0}
              duration={mediaDuration}
              updatedAt={positionUpdatedAt}
              isPlaying={isPlaying}
              canSeek={canSeek}
              onSeek={handleSeek}
              group={group}
            />
          )}

          {/* Transport */}
          {showTransport && (
            <div className="flex items-center justify-center gap-2">
              {isTvMode ? (
                <>
                  {tvHasRew && (
                    <IconButton icon="mdi:rewind" iconSize={18} onClick={() => sendCommand("rewind")} />
                  )}
                  {tvHasPrev && (
                    <IconButton icon="mdi:skip-previous" iconSize={18} onClick={() => sendCommand("previous")} />
                  )}
                  <IconButton
                    icon={isPlaying ? "mdi:pause" : "mdi:play"}
                    iconSize={22}
                    variant="filled"
                    shape="full"
                    className="min-h-[48px]! min-w-[48px]! bg-accent! shadow-[0_2px_8px_theme(--color-accent/35%)]"
                    onClick={() => sendCommand("play_pause")}
                  />
                  {tvHasNext && (
                    <IconButton icon="mdi:skip-next" iconSize={18} onClick={() => sendCommand("next")} />
                  )}
                  {tvHasFfw && (
                    <IconButton icon="mdi:fast-forward" iconSize={18} onClick={() => sendCommand("fast_forward")} />
                  )}
                </>
              ) : (
                <>
                  {audioHasPrev && (
                    <IconButton icon="mdi:skip-previous" iconSize={20} onClick={() => callMedia("media_previous_track")} />
                  )}
                  {audioHasPlayPause && (
                    <IconButton
                      icon={playControl.displayValue ? "mdi:pause" : "mdi:play"}
                      iconSize={22}
                      variant="filled"
                      shape="full"
                      className="min-h-[48px]! min-w-[48px]! bg-accent! shadow-[0_2px_8px_theme(--color-accent/35%)]"
                      phase={playControl.phase}
                      onClick={() => playControl.set(!playControl.displayValue)}
                    />
                  )}
                  {audioHasNext && (
                    <IconButton icon="mdi:skip-next" iconSize={20} onClick={() => callMedia("media_next_track")} />
                  )}
                </>
              )}
            </div>
          )}

          {/* Volume — shared across both modes */}
          {hasVolumeRow && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <button
                  className="flex items-center gap-1 text-[10px] text-text-dim"
                  onClick={() => canVolumeMute && muteControl.set(!muteControl.displayValue)}
                >
                  <Icon icon={muteControl.displayValue ? "mdi:volume-off" : "mdi:volume-medium"} width={14} />
                  <span>Volume</span>
                </button>
                <span className="text-[10px] tabular-nums text-text-dim">
                  {slider.displayValue}%
                </span>
              </div>
              <SliderTrack slider={slider} formatValue={(v) => `${Math.round(v)}%`} />
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
