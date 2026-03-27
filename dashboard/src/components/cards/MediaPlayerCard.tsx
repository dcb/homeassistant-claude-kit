import { useState, useEffect, useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import type { RoomConfig } from "../../lib/areas";
import { getAppIcon, getAdapter, type TvAdapter } from "../../lib/tv-adapter";
import { useSliderControl } from "../../lib/useSliderControl";
import { IconButton } from "../controls/IconButton";
import { SliderTrack } from "../controls/SliderTrack";
import { RemotePopup } from "../popups/RemotePopup";
import { SeekBar } from "../controls/SeekBar";
import { getEntityPicture, entityPictureOnError } from "../../lib/entity-picture";

interface MediaPlayerCardProps {
  mediaPlayerId: string;
  room: RoomConfig;
  entities: HassEntities;
  roomLabel?: string;
}

export function MediaPlayerCard({
  mediaPlayerId,
  room,
  entities,
  roomLabel,
}: MediaPlayerCardProps) {
  const connection = useHass((s) => s.connection);
  const [adapter, setAdapter] = useState<TvAdapter | null>(null);
  const [remoteOpen, setRemoteOpen] = useState(false);

  useEffect(() => {
    if (!room.tvPlatform) return;
    getAdapter(room.tvPlatform).then(setAdapter);
  }, [room.tvPlatform]);

  const entity = entities[mediaPlayerId];

  if (!entity || entity.state === "unavailable") return null;

  const name = (entity.attributes?.friendly_name as string) ?? mediaPlayerId;
  const title = entity.attributes?.media_title as string | undefined;
  const artist = entity.attributes?.media_artist as string | undefined;
  const appName = entity.attributes?.app_name as string | undefined;
  const picture = getEntityPicture(entity.attributes as Record<string, unknown>);
  const state = entity.state;
  const isActive = state === "playing" || state === "paused" || state === "buffering";
  const features = (entity.attributes?.supported_features as number) ?? 0;

  // Volume: prefer explicit volumeEntity (e.g. soundbar DLNA)
  const volEntity = room.volumeEntity
    ? entities[room.volumeEntity] ?? entity
    : entity;
  const volEntityId = room.volumeEntity ?? mediaPlayerId;
  const volume = volEntity.attributes?.volume_level as number | undefined;
  const isMuted = volEntity.attributes?.is_volume_muted as boolean | undefined;
  const volFeatures =
    (volEntity.attributes?.supported_features as number) ?? 0;

  // Power state: prefer remote entity, fall back to media player state
  const remoteState = room.remoteEntity
    ? entities[room.remoteEntity]?.state
    : undefined;
  const isRemoteOn =
    remoteState === "on" ||
    state === "on" ||
    state === "playing" ||
    state === "paused";

  // Feature flags
  const canPause = (features & 1) !== 0;
  const canSeek = (features & 2) !== 0;
  const canVolumeSet = (volFeatures & 4) !== 0;
  const canVolumeMute = (volFeatures & 8) !== 0;
  const canPrevious = (features & 16) !== 0;
  const canNext = (features & 32) !== 0;
  const canPlay = (features & 16384) !== 0;

  // Media position for seek bar
  const mediaDuration = entity.attributes?.media_duration as number | undefined;
  const mediaPosition = entity.attributes?.media_position as number | undefined;
  const positionUpdatedAt = entity.attributes
    ?.media_position_updated_at as string | undefined;

  // App icon — adapter for current_activity/source, fallback to Cast app_name
  const adapterApp = adapter?.getCurrentApp(
    entities,
    room.remoteEntity ?? "",
    mediaPlayerId,
  );
  const appIcon = adapterApp ?? getAppIcon(appName);

  const callMedia = (service: string, data?: Record<string, unknown>) => {
    if (!connection) return;
    callService(connection, "media_player", service, data, {
      entity_id: mediaPlayerId,
    }).catch(() => {});
  };

  const callRemote = (service: string) => {
    if (!connection || !room.remoteEntity) return;
    callService(connection, "remote", service, {}, {
      entity_id: room.remoteEntity,
    }).catch(() => {});
  };

  // --- Card content by state ---
  let cardContent: React.ReactNode;

  if (!isActive && !isRemoteOn) {
    // Off state: no remote or remote is off, and not playing
    cardContent = (
      <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-3">
        <div className="min-w-0">
          <span className="text-sm">{name}</span>
          {roomLabel && (
            <div className="text-[10px] text-text-dim">{roomLabel}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={room.remoteEntity ? "mdi:remote" : "mdi:tune-vertical"}
            onClick={() => setRemoteOpen(true)}
          />
          {room.remoteEntity && (
            <IconButton
              icon="mdi:power"
              onClick={() => callRemote("turn_on")}
            />
          )}
        </div>
      </div>
    );
  } else if (!isActive && isRemoteOn) {
    // On-idle state: remote on but not playing/paused
    cardContent = (
      <div className="rounded-xl bg-bg-elevated p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {appIcon && (
                <Icon
                  icon={appIcon.icon}
                  width={14}
                  style={{ color: appIcon.color }}
                  className="shrink-0"
                />
              )}
              <span className="truncate text-sm">{name}</span>
            </div>
            {roomLabel && (
              <div className="text-[10px] text-text-dim">{roomLabel}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={room.remoteEntity ? "mdi:remote" : "mdi:tune-vertical"}
              onClick={() => setRemoteOpen(true)}
            />
            <IconButton
              icon="mdi:power"
              className="text-accent-green"
              onClick={() => callRemote("turn_off")}
            />
          </div>
        </div>
        {canVolumeSet && volume != null && (
          <div className="mt-2">
            <VolumeSlider
              volume={volume}
              isMuted={isMuted}
              canVolumeMute={canVolumeMute}
              onVolumeChange={(level) => {
                if (!connection) return;
                callService(connection, "media_player", "volume_set", { volume_level: level }, {
                  entity_id: volEntityId,
                }).catch(() => {});
              }}
              onMuteToggle={() => {
                if (!connection) return;
                callService(connection, "media_player", "volume_mute", { is_volume_muted: !isMuted }, {
                  entity_id: volEntityId,
                }).catch(() => {});
              }}
            />
          </div>
        )}
      </div>
    );
  } else {
    // Active state: playing/paused/buffering — full card
    cardContent = (
      <div className="overflow-hidden rounded-xl bg-bg-elevated">
        <div className="flex gap-3 p-3.5">
          {picture && (
            <img
              src={picture.src}
              data-fallback={picture.fallback}
              alt=""
              className="w-24 self-stretch shrink-0 rounded-lg object-cover"
              onError={entityPictureOnError}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            {/* Title / artist / app icon */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {appIcon && (
                    <Icon
                      icon={appIcon.icon}
                      width={14}
                      style={{ color: appIcon.color }}
                      className="shrink-0"
                    />
                  )}
                  <span className="truncate text-sm font-medium">
                    {title ?? name}
                  </span>
                </div>
                {artist && (
                  <div className="truncate text-xs text-text-dim">{artist}</div>
                )}
                {roomLabel && (
                  <div className="text-[10px] text-text-dim">{roomLabel}</div>
                )}
              </div>
              {room.remoteEntity && (
                <IconButton
                  icon="mdi:power"
                  className="text-accent-green"
                  onClick={() => callRemote("turn_off")}
                />
              )}
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-1">
              {canPrevious && (
                <IconButton
                  icon="mdi:skip-previous"
                  iconSize={18}
                  onClick={() => callMedia("media_previous_track")}
                  aria-label="Previous track"
                />
              )}
              {(canPause || canPlay) && (
                <IconButton
                  icon={state === "playing" ? "mdi:pause" : "mdi:play"}
                  iconSize={18}
                  variant="filled"
                  shape="full"
                  onClick={() => callMedia("media_play_pause")}
                  aria-label={state === "playing" ? "Pause" : "Play"}
                />
              )}
              {canNext && (
                <IconButton
                  icon="mdi:skip-next"
                  iconSize={18}
                  onClick={() => callMedia("media_next_track")}
                  aria-label="Next track"
                />
              )}
              <div className="flex-1" />
              <IconButton
                icon={room.remoteEntity ? "mdi:remote" : "mdi:tune-vertical"}
                onClick={() => setRemoteOpen(true)}
              />
            </div>

            {/* Volume */}
            {canVolumeSet && volume != null && (
              <VolumeSlider
                volume={volume}
                isMuted={isMuted}
                canVolumeMute={canVolumeMute}
                onVolumeChange={(level) => {
                  if (!connection) return;
                  callService(connection, "media_player", "volume_set", { volume_level: level }, {
                    entity_id: volEntityId,
                  }).catch(() => {});
                }}
                onMuteToggle={() => {
                  if (!connection) return;
                  callService(connection, "media_player", "volume_mute", { is_volume_muted: !isMuted }, {
                    entity_id: volEntityId,
                  }).catch(() => {});
                }}
              />
            )}
          </div>
        </div>

        {/* Seek bar — thin display-only bar below card content */}
        {canSeek && mediaDuration != null && mediaDuration > 0 && (
          <SeekBar
            duration={mediaDuration}
            position={mediaPosition ?? 0}
            updatedAt={positionUpdatedAt}
            isPlaying={state === "playing"}
            canSeek={false}
            variant="slim"
          />
        )}
      </div>
    );
  }

  return (
    <>
      {cardContent}
      <RemotePopup
        room={room}
        mediaPlayerId={mediaPlayerId}
        open={remoteOpen}
        onClose={() => setRemoteOpen(false)}
        entities={entities}
      />
    </>
  );
}

// --- Volume slider (same pattern as MediaSection) ---

function VolumeSlider({
  volume,
  isMuted,
  canVolumeMute,
  onVolumeChange,
  onMuteToggle,
}: {
  volume: number;
  isMuted: boolean | undefined;
  canVolumeMute: boolean;
  onVolumeChange: (level: number) => void;
  onMuteToggle: () => void;
}) {
  const commitVolume = useCallback(
    (pct: number) => onVolumeChange(pct / 100),
    [onVolumeChange],
  );
  const slider = useSliderControl(Math.round(volume * 100), commitVolume, {
    min: 0,
    max: 100,
    step: 1,
  });

  return (
    <div className="flex items-center gap-2">
      {canVolumeMute && (
        <IconButton
          icon={isMuted ? "mdi:volume-off" : "mdi:volume-medium"}
          onClick={onMuteToggle}
          aria-label={isMuted ? "Unmute" : "Mute"}
        />
      )}
      <SliderTrack slider={slider} formatValue={(v) => `${Math.round(v)}%`} />
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-text-dim">
        {slider.displayValue}%
      </span>
    </div>
  );
}
