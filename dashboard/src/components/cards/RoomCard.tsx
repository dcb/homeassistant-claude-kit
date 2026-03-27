import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { RoomConfig } from "../../lib/areas";
import { useRoomState } from "../../hooks/useRoomState";
import { useLightGradient } from "../../hooks/useLightGradient";
import { useRoomActions } from "../../hooks/useRoomActions";

interface RoomCardProps {
  room: RoomConfig;
  onTap: () => void;
}

export function RoomCard({ room, onTap }: RoomCardProps) {
  const entities = useHass((s) => s.entities) as HassEntities;

  const gradient = useLightGradient(room.lights, entities);
  const state = useRoomState(room, entities);
  const {
    temp,
    humidity,
    co2,
    targetTemp,
    lightsOn,
    totalLights,
    lightsIconColor,
    isOccupied,
    coversOpen,
    totalCovers,
    openContacts,
    heatingTrvCount,
    acAction,
    mediaEntity,
    mediaAppName,
    isMuted,
    dishwasherStatus,
    dishwasherRemaining,
  } = state;

  const actions = useRoomActions(room, {
    lightsOn,
    coversOpen,
    activeMedia: state.activeMedia,
    mediaState: mediaEntity?.state,
    isMuted,
  });

  // Wrap handlers to stop card navigation
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onTap}
      className="contain-card relative flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl bg-bg-card p-4 text-left transition-colors hover:bg-bg-elevated"
      style={gradient ? { backgroundImage: gradient } : undefined}
    >
      {/* Header: name + occupancy | temp + humidity */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{room.name}</h3>
          {isOccupied && (
            <span className="h-2 w-2 animate-occupancy rounded-full bg-accent-green" />
          )}
        </div>
        {temp && (
          <div className="text-right">
            <div className="flex items-baseline gap-1.5 justify-end">
              {humidity !== null && (
                <span className="flex items-center gap-0.5 text-xs text-text-dim">
                  <Icon icon="mdi:water-percent" width={11} />
                  <span className="tabular-nums">{Math.round(humidity)}%</span>
                </span>
              )}
              <span className="text-lg font-semibold tabular-nums">{temp}°</span>
            </div>
            {targetTemp !== null && (
              <div className="flex items-center justify-end gap-0.5 text-xs text-text-dim tabular-nums">
                <Icon icon="mdi:target" width={10} />
                {Math.round(targetTemp)}°
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status indicators */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        {/* Lights */}
        {totalLights > 0 && (
          <span
            className={`relative flex items-center gap-1 rounded-md px-1 -mx-1 transition-transform after:absolute after:content-[''] after:-inset-2 ${actions.lightsPhase !== "idle" ? "pointer-events-none animate-pulse" : "hover:text-text-primary active:text-text-primary active:scale-95"}`}
            onClick={stop(actions.toggleLights)}
          >
            <Icon
              icon="mdi:lightbulb"
              width={14}
              style={lightsIconColor ? { color: lightsIconColor } : undefined}
              className={lightsIconColor ? "glow-light" : "text-text-dim"}
            />
            {lightsOn > 0 ? `${lightsOn} on` : "Off"}
          </span>
        )}

        {/* Covers / blinds */}
        {totalCovers > 0 && (
          <span
            className={`relative flex items-center gap-1 rounded-md px-1 -mx-1 transition-transform after:absolute after:content-[''] after:-inset-2 ${actions.coversPhase !== "idle" ? "pointer-events-none animate-pulse" : "hover:text-text-primary active:text-text-primary active:scale-95"}`}
            onClick={stop(actions.toggleCovers)}
          >
            <Icon
              icon={coversOpen > 0 ? "mdi:blinds-open" : "mdi:blinds"}
              width={14}
              className={coversOpen > 0 ? "text-text-secondary" : "text-text-dim"}
            />
            {coversOpen > 0
              ? coversOpen === totalCovers ? "Open" : `${coversOpen}/${totalCovers}`
              : "Closed"}
          </span>
        )}

        {/* Contact sensors (window/door) — only shown when open */}
        {openContacts.map((s) => (
          <span key={s.entity} className="flex items-center gap-1 text-accent-warm">
            <Icon icon={s.type === "door" ? "mdi:door-open" : "mdi:window-open-variant"} width={14} />
            {s.label}
          </span>
        ))}

        {/* CO2 */}
        {co2 !== null && (
          <span className={`flex items-center gap-1 ${
            co2 > 1000 ? "text-accent-warm" : "text-text-dim"
          }`}>
            <Icon icon="mdi:molecule-co2" width={14} />
            <span className="tabular-nums">{Math.round(co2)}</span>
          </span>
        )}

        {/* Media */}
        {mediaEntity && (
          <span className="flex items-center gap-1 truncate">
            <span
              className={`relative shrink-0 rounded-full p-0.5 transition-transform after:absolute after:content-[''] after:-inset-3 ${actions.mediaPhase !== "idle" ? "pointer-events-none animate-pulse" : "hover:bg-white/10 active:bg-white/10 active:scale-95"}`}
              onClick={stop(actions.togglePlayback)}
            >
              <Icon
                icon={mediaEntity.state === "playing" ? "mdi:pause-circle" : "mdi:play-circle"}
                width={14}
                className="text-accent"
              />
            </span>
            <span className="truncate">
              {mediaEntity.attributes?.media_title ?? "Playing"}
            </span>
            <span
              className={`relative shrink-0 rounded-full p-0.5 transition-transform after:absolute after:content-[''] after:-inset-3 ${actions.mutePhase !== "idle" ? "pointer-events-none animate-pulse" : "hover:bg-white/10 active:bg-white/10 active:scale-95"}`}
              onClick={stop(actions.toggleMute)}
            >
              <Icon
                icon={isMuted ? "mdi:volume-off" : "mdi:volume-medium"}
                width={14}
                className={isMuted ? "text-accent-red" : "text-text-dim"}
              />
            </span>
          </span>
        )}
        {!mediaEntity && mediaAppName && (
          <span className="flex items-center gap-1 truncate">
            <Icon icon="mdi:television" width={14} className="shrink-0 text-text-secondary" />
            <span className="truncate">{mediaAppName}</span>
          </span>
        )}

        {/* Dishwasher — only on kitchen card, only when online */}
        {(dishwasherStatus === "running" || dishwasherStatus === "ending") && (
          <span className="flex items-center gap-1 text-accent-cool">
            <Icon icon="mdi:dishwasher" width={14} className="shrink-0 dishwasher-active" />
            <span className="tabular-nums">{dishwasherRemaining ?? "—"}min</span>
          </span>
        )}
        {dishwasherStatus === "ready" && (
          <span className="flex items-center gap-1 text-accent-green">
            <Icon icon="mdi:dishwasher" width={14} className="shrink-0" />
            Done
          </span>
        )}

        {/* Climate indicators — right-aligned in same row */}
        {(heatingTrvCount > 0 || acAction) && (
          <span className="ml-auto flex items-center gap-2">
            {heatingTrvCount > 0 && (
              <span
                className="flex items-center gap-0.5"
                style={{ animation: "glow-warm 2s ease-in-out infinite" }}
              >
                <Icon icon="lucide:heater" width={14} />
                <span className="tabular-nums">{heatingTrvCount}</span>
              </span>
            )}
            {acAction && (
              <span
                className="flex items-center"
                style={{
                  animation: `${acAction === "cooling" ? "glow-cool" : "glow-warm"} 2s ease-in-out infinite`,
                }}
              >
                <Icon icon="mynaui:air-vent-solid" width={14} />
              </span>
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
}
