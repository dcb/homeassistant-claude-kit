import { useState, useCallback, useRef } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Icon } from "@iconify/react";
import { ROOMS, USER_ROOM_MAP, type RoomConfig } from "../lib/areas";
import {
  CONTEXT_CONFIG,
  QUICK_ACTIONS_CONFIG,
  ACTIVE_AUTOMATIONS_CONFIG,
  VACUUM_CONFIG,
} from "../lib/entities";
import { ContextCard } from "../components/cards/ContextCard";
import { QuickActions } from "../components/cards/QuickActions";
import { RoomCard } from "../components/cards/RoomCard";
import { ActiveAutomations } from "../components/cards/ActiveAutomations";
import { VacuumCard } from "../components/cards/VacuumCard";
import { MediaPlayerCard } from "../components/cards/MediaPlayerCard";
import { RoomPopup } from "../components/popups/RoomPopup";

/**
 * Sort rooms by most recent occupancy activity.
 * If the current user has a pinned room, it goes first.
 */
function sortRooms(
  entities: HassEntities,
  pinnedRoomId: string | undefined,
): RoomConfig[] {
  return [...ROOMS].sort((a, b) => {
    // Pinned room always first
    if (pinnedRoomId) {
      if (a.id === pinnedRoomId) return -1;
      if (b.id === pinnedRoomId) return 1;
    }

    const aTime = a.occupancySensor
      ? new Date(entities[a.occupancySensor]?.last_changed ?? 0).getTime()
      : 0;
    const bTime = b.occupancySensor
      ? new Date(entities[b.occupancySensor]?.last_changed ?? 0).getTime()
      : 0;
    return bTime - aTime; // most recent first
  });
}

const PULL_THRESHOLD = 60;

export function HomeView() {
  const entities = useHass((s) => s.entities) as HassEntities;
  const user = useHass((s) => s.user);
  const pinnedRoomId = user?.name
    ? USER_ROOM_MAP[user.name.toLowerCase()]
    : undefined;

  // Sort once on mount (re-mounts on tab switch due to AnimatePresence key)
  const [sortedRooms, setSortedRooms] = useState(() =>
    sortRooms(entities, pinnedRoomId),
  );
  const [selectedRoom, setSelectedRoom] = useState<RoomConfig | null>(null);

  // Find rooms with active TVs (remote or media player is "on")
  const activeMediaRooms = ROOMS.flatMap((room) => {
    if (!room.remoteEntity || !room.mediaPlayers?.length) return [];
    const remoteBase = room.remoteEntity.split(".")[1];
    const tvPlayer =
      room.mediaPlayers.find((id) => id.endsWith(remoteBase)) ??
      room.mediaPlayers[0];
    const remoteState = entities[room.remoteEntity]?.state;
    const playerState = entities[tvPlayer]?.state;
    const isOn =
      remoteState === "on" ||
      playerState === "on" ||
      playerState === "playing" ||
      playerState === "paused";
    if (!isOn) return [];
    return [{ room, mediaPlayerId: tvPlayer }];
  });

  // Pull-to-refresh
  const pullY = useMotionValue(0);
  const indicatorOpacity = useTransform(pullY, [0, PULL_THRESHOLD], [0, 1]);
  const indicatorRotation = useTransform(pullY, [0, PULL_THRESHOLD], [0, 180]);
  const touchStartRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const main = (e.currentTarget as HTMLElement).closest("main");
    if (main && main.scrollTop <= 0) {
      touchStartRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartRef.current === null) return;
      const delta = e.touches[0].clientY - touchStartRef.current;
      if (delta > 0) {
        pullY.set(Math.min(delta * 0.4, 80));
      }
    },
    [pullY],
  );

  const handleTouchEnd = useCallback(() => {
    if (pullY.get() >= PULL_THRESHOLD) {
      setSortedRooms(sortRooms(entities, pinnedRoomId));
    }
    animate(pullY, 0, { type: "spring", stiffness: 300, damping: 30 });
    touchStartRef.current = null;
  }, [entities, pinnedRoomId, pullY]);

  return (
    <div
      className="mx-auto max-w-2xl space-y-4 py-2"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        style={{ opacity: indicatorOpacity, height: pullY }}
        className="flex items-center justify-center overflow-hidden"
      >
        <motion.div style={{ rotate: indicatorRotation }}>
          <Icon icon="mdi:arrow-down" width={20} className="text-text-dim" />
        </motion.div>
      </motion.div>

      <ContextCard config={CONTEXT_CONFIG} />
      <QuickActions config={QUICK_ACTIONS_CONFIG} />

      {/* Now Playing — active TVs */}
      <AnimatePresence>
        {activeMediaRooms.map(({ room, mediaPlayerId }) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MediaPlayerCard
              mediaPlayerId={mediaPlayerId}
              room={room}
              entities={entities}
              roomLabel={room.name}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Room cards — sorted on mount & pull-to-refresh */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sortedRooms.map((room, i) => (
          <motion.div
            key={room.id}
            className="h-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
          >
            <RoomCard
              room={room}
              onTap={() => setSelectedRoom(room)}
            />
          </motion.div>
        ))}
      </div>

      <VacuumCard config={VACUUM_CONFIG} />

      <ActiveAutomations config={ACTIVE_AUTOMATIONS_CONFIG} />

      <RoomPopup
        room={selectedRoom}
        open={selectedRoom !== null}
        onClose={() => setSelectedRoom(null)}
      />
    </div>
  );
}
