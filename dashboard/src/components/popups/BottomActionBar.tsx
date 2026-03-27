import { Icon } from "@iconify/react";
import type { RoomConfig } from "../../lib/areas";
import type { RoomState } from "../../hooks/useRoomState";
import { useRoomActions } from "../../hooks/useRoomActions";

interface BottomActionBarProps {
  room: RoomConfig;
  state: RoomState;
  onScrollTo: (section: "covers" | "climate" | "media") => void;
}

export function BottomActionBar({ room, state, onScrollTo }: BottomActionBarProps) {
  const hasClimate = (room.climate?.length ?? 0) > 0;
  const hasMedia = (room.mediaPlayers?.length ?? 0) > 0;
  const hasCovers = (room.covers?.length ?? 0) > 0;

  // Hook must be called unconditionally (Rules of Hooks)
  const actions = useRoomActions(room, {
    lightsOn: state.lightsOn,
    coversOpen: state.coversOpen,
    activeMedia: state.activeMedia,
    mediaState: state.mediaEntity?.state,
    isMuted: state.isMuted,
  });

  if (!hasClimate && !hasMedia && !hasCovers) return null;

  const lightsActive = state.lightsOn > 0;

  return (
    <nav className="shrink-0 border-t border-white/5 bg-bg-primary/90 backdrop-blur-lg">
      <div className="flex items-center justify-center gap-1 px-3 pb-[env(safe-area-inset-bottom)]">
        {/* Lights toggle */}
        {state.totalLights > 0 && (
          <button
            onClick={actions.toggleLights}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/5 hover:text-text-primary ${actions.lightsPhase !== "idle" ? "pointer-events-none animate-pulse" : ""}`}
          >
            <Icon
              icon="mdi:lightbulb"
              width={22}
              style={state.lightsIconColor ? { color: state.lightsIconColor } : undefined}
              className={state.lightsIconColor ? "glow-light" : "text-text-dim"}
            />
            <span className={`text-[10px] leading-tight ${lightsActive ? "text-text-secondary" : "text-text-dim"}`}>
              {lightsActive ? `${state.lightsOn} on` : "Off"}
            </span>
          </button>
        )}

        {/* Covers — scroll to section */}
        {hasCovers && (
          <button
            onClick={() => onScrollTo("covers")}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-text-dim transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <Icon icon={state.coversOpen > 0 ? "mdi:blinds-open" : "mdi:blinds"} width={22} />
            <span className="text-[10px] leading-tight">Covers</span>
          </button>
        )}

        {/* Climate — scroll to section */}
        {hasClimate && (
          <button
            onClick={() => onScrollTo("climate")}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-text-dim transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <Icon icon="mdi:thermometer" width={22} />
            <span className="text-[10px] leading-tight">Climate</span>
          </button>
        )}

        {/* Media — scroll to section */}
        {hasMedia && (
          <button
            onClick={() => onScrollTo("media")}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-text-dim transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <Icon icon="mdi:television" width={22} />
            <span className="text-[10px] leading-tight">Media</span>
          </button>
        )}

      </div>
    </nav>
  );
}
