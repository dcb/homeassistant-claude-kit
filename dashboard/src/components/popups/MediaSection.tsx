import type { HassEntities } from "home-assistant-js-websocket";
import type { RoomConfig } from "../../lib/areas";
import { MediaPlayerCard } from "../cards/MediaPlayerCard";
import { Section } from "./RoomPopupShared";

interface MediaSectionProps {
  room: RoomConfig;
  entities: HassEntities;
}

export function MediaSection({ room, entities }: MediaSectionProps) {
  return (
    <Section title="Media">
      <div className="space-y-2">
        {room.mediaPlayers?.map((id) => (
          <MediaPlayerCard
            key={id}
            mediaPlayerId={id}
            room={room}
            entities={entities}
          />
        ))}
      </div>
    </Section>
  );
}
