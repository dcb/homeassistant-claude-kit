import { useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { useSliderControl } from "../../lib/useSliderControl";
import { IconButton } from "./IconButton";
import { SliderTrack } from "./SliderTrack";

interface CoverControlProps {
  entityId: string;
  /** Prefix to strip from friendly_name (e.g. "Bedroom") */
  stripPrefix?: string;
}

export function CoverControl({ entityId, stripPrefix }: CoverControlProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);

  const entity = entities[entityId];

  const position = entity?.attributes?.current_position as number | undefined;

  const commitPosition = useCallback((pos: number) => {
    if (!connection) return;
    callService(connection, "cover", "set_cover_position", { position: pos }, { entity_id: entityId });
  }, [connection, entityId]);

  const slider = useSliderControl(position ?? 0, commitPosition, { min: 0, max: 100, step: 1 });

  const callCover = useCallback((service: string) => {
    if (!connection) return;
    callService(connection, "cover", service, {}, { entity_id: entityId });
  }, [connection, entityId]);

  if (!entity) return null;

  const isUnavailable = entity.state === "unavailable" || entity.state === "unknown";
  const state = entity.state as string;
  const isMoving = state === "opening" || state === "closing";
  const isOpen = state === "open";

  const friendlyName = (entity.attributes?.friendly_name as string) ?? entityId.split(".")[1];
  const stripped = stripPrefix
    ? friendlyName.replace(new RegExp(`^${stripPrefix}\\s*`, "i"), "")
    : friendlyName;
  const rawName = stripped || friendlyName;
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Icon based on position/state
  const icon = position != null && position > 0 ? "mdi:blinds-open" : "mdi:blinds";

  if (isUnavailable) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-3 opacity-50">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:blinds" width={18} className="text-text-dim" />
          <span className="text-sm text-text-dim">{name}</span>
        </div>
        <span className="text-xs text-accent-red">Unavailable</span>
      </div>
    );
  }

  const displayPos = slider.displayValue;

  return (
    <div className="overflow-hidden rounded-xl bg-bg-elevated">
      {/* Header: icon + name + position + state */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            icon={icon}
            width={18}
            className={isOpen ? "text-accent-cool" : "text-text-dim"}
          />
          <span className="truncate text-sm">{name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs tabular-nums text-text-dim">{displayPos}%</span>
          {isMoving && (
            <span className="text-xs capitalize text-accent-cool">{state}</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2">
        <IconButton icon="mdi:arrow-down" onClick={() => callCover("close_cover")} aria-label="Close blinds" />
        <IconButton icon="mdi:stop" onClick={() => callCover("stop_cover")} aria-label="Stop" />
        <IconButton icon="mdi:arrow-up" onClick={() => callCover("open_cover")} aria-label="Open blinds" />
      </div>

      {/* Position slider */}
      <div className="px-3 pb-3">
        <SliderTrack
          slider={slider}
          trackGradient="linear-gradient(to right, var(--color-surface-dim), var(--color-accent-cover))"
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </div>
    </div>
  );
}
