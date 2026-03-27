import { useRef } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import type { RoomConfig } from "../../lib/areas";
import {
  CLIMATE_MODE,
  NEXT_CLIMATE_TRANSITION,
} from "../../lib/entities";
import { AC_UNITS } from "../../lib/acUnits";
import { useRoomState } from "../../hooks/useRoomState";
import { LightControl } from "../controls/LightControl";
import { CoverControl } from "../controls/CoverControl";
import { ClimateCluster, SensorBar } from "./HeaderStats";
import { BottomActionBar } from "./BottomActionBar";
import { ClimateSection } from "./ClimateSection";
import { MediaSection } from "./MediaSection";
import { Section } from "./RoomPopupShared";
import { BottomSheet } from "./BottomSheet";

interface RoomPopupProps {
  room: RoomConfig | null;
  open: boolean;
  onClose: () => void;
}

export function RoomPopup({ room, open, onClose }: RoomPopupProps) {
  return (
    <BottomSheet open={open && !!room} onClose={onClose} className="flex flex-col overflow-hidden md:max-w-md">
      {room && <RoomContent room={room} />}
    </BottomSheet>
  );
}

function RoomContent({ room }: { room: RoomConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const state = useRoomState(room, entities);

  const hasClimate = (room.climate?.length ?? 0) > 0;
  const hasMedia = (room.mediaPlayers?.length ?? 0) > 0;

  // Section refs for scroll-to
  const coversRef = useRef<HTMLDivElement>(null);
  const climateRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  const scrollTo = (section: "covers" | "climate" | "media") => {
    const ref = { covers: coversRef, climate: climateRef, media: mediaRef }[section];
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-5">
        <div className="space-y-5 pb-5">
          {/* Compact header — sticky */}
          <div className="sticky top-0 z-10 -mx-5 bg-bg-card px-5 pb-3 pt-4">
            <div className="space-y-1.5 pb-3 border-b border-white/8">
              {/* Row 1: Title + occupancy dot | Climate cluster */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <DialogTitle className="text-lg font-semibold truncate">{room.name}</DialogTitle>
                  <DialogDescription className="sr-only">
                    Controls and sensors for {room.name}
                  </DialogDescription>
                  {state.isOccupied && (
                    <span className="h-1.5 w-1.5 shrink-0 animate-occupancy rounded-full bg-accent-green" />
                  )}
                </div>
                <ClimateCluster state={state} />
              </div>
              {/* Row 2: Other sensors */}
              <SensorBar room={room} state={state} />
            </div>
          </div>

          {/* Lights */}
          {room.lights.length > 0 && (
            <Section title="Lights">
              <div className="space-y-2">
                {room.lights.map((id) => (
                  <LightControl key={id} entityId={id} stripPrefix={room.name} />
                ))}
              </div>
            </Section>
          )}

          {/* Covers */}
          {(room.covers?.length ?? 0) > 0 && (
            <div ref={coversRef}>
              <Section title="Covers">
                <div className="space-y-2">
                  {room.covers!.map((id) => (
                    <CoverControl key={id} entityId={id} stripPrefix={room.name} />
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* Climate */}
          {hasClimate && (
            <div ref={climateRef}>
              <ClimateSection
                room={room}
                entities={entities}
                climateModeEntity={CLIMATE_MODE}
                nextTransitionEntity={NEXT_CLIMATE_TRANSITION}
                acUnits={AC_UNITS}
              />
            </div>
          )}

          {/* Media */}
          {hasMedia && (
            <div ref={mediaRef}>
              <MediaSection room={room} entities={entities} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar — outside scroll, pinned to flex bottom */}
      <BottomActionBar room={room} state={state} onScrollTo={scrollTo} />
    </>
  );
}
