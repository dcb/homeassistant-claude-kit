/**
 * @file DishwasherSection — Appliance state machine display (hOn integration).
 *
 * @ha-integration hOn (paroque28 fork) — generic appliance cloud integration
 * @ha-helpers    input_select.dishwasher_state (values: idle, running, pause, ending, scheduled, error)
 * @ha-automation config/automations/dishwasher.yaml — drives the HA-side state machine
 *
 * The appliance WiFi module powers down between cycles (EU ecodesign regulation — by design,
 * not a bug). All integration sensors go unavailable during this window. The UI state machine
 * is driven by input_select.dishwasher_state (HA-side), which persists independently of the
 * integration and survives WiFi gaps. Do NOT rely on integration sensor state for cycle tracking.
 *
 * Remove this block once prerequisites are satisfied and entity IDs are filled in entities.ts.
 */
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { parseNumericState } from "../../lib/format";
import type { ApplianceConfig } from "../../lib/entities";
import { Section } from "./RoomPopupShared";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  ready:     { label: "Ready",     color: "text-accent-green",    icon: "mdi:dishwasher" },
  running:   { label: "Running",   color: "text-accent",          icon: "mdi:dishwasher" },
  pause:     { label: "Paused",    color: "text-accent-warm",     icon: "mdi:pause-circle" },
  scheduled: { label: "Scheduled", color: "text-text-secondary",  icon: "mdi:clock-outline" },
  ending:    { label: "Finishing", color: "text-accent-cool",     icon: "mdi:check-circle" },
  error:     { label: "Error",     color: "text-accent-red",      icon: "mdi:alert-circle" },
  test:      { label: "Test",      color: "text-text-dim",        icon: "mdi:flask" },
};

const PHASE_LABELS: Record<string, string> = {
  ready: "Ready",
  prewash: "Pre-wash",
  washing: "Washing",
  rinse: "Rinsing",
  drying: "Drying",
  hot_rinse: "Hot rinse",
};

interface DishwasherSectionProps {
  entities: HassEntities;
  config: ApplianceConfig;
}

export function DishwasherSection({ entities, config }: DishwasherSectionProps) {
  const connection = useHass((s) => s.connection);

  const statusRaw = entities[config.status]?.state;
  const isUnavailable = statusRaw === undefined || statusRaw === "unavailable" || statusRaw === "unknown";
  const meta = STATUS_META[statusRaw ?? ""] ?? { label: "Offline", color: "text-text-dim", icon: "mdi:dishwasher-off" };
  const isActive = statusRaw === "running" || statusRaw === "ending";

  const phaseRaw = entities[config.phase]?.state ?? "";
  const phaseLabel = PHASE_LABELS[phaseRaw] ?? phaseRaw;
  const remaining = parseNumericState(entities[config.timeRemaining]?.state);
  const program = entities[config.program]?.state;
  const error = entities[config.error]?.state;
  const showProgram = program && program !== "unknown" && program !== "unavailable";

  const saltLow = entities[config.saltLevel]?.state === "on";
  const rinseAidLow = entities[config.rinseAidLevel]?.state === "on";

  const dishwasherState = entities[config.state]?.state ?? "dirty";
  const cycles = parseNumericState(entities[config.cycles]?.state);

  const handleToggleDirty = () => {
    if (!connection || dishwasherState !== "clean") return;
    callService(
      connection,
      "input_select",
      "select_option",
      { option: "dirty" },
      { entity_id: config.state },
    );
  };

  return (
    <Section title="Dishwasher">
      <div className={`rounded-xl bg-bg-elevated p-3.5 ${isUnavailable && dishwasherState !== "clean" ? "opacity-50" : ""}`}>
        {/* Header: name + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon
              icon="mdi:dishwasher"
              width={18}
              className={isActive ? "text-accent dishwasher-active" : "text-text-secondary"}
            />
            <span className="text-sm font-medium">Dishwasher</span>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
            {meta.label}
            {isActive && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
          </span>
        </div>

        {/* Secondary info: program + clean/dirty state */}
        <div className="mt-1 flex items-center gap-2 text-xs text-text-dim">
          {showProgram && <span>{program.replace(/_/g, " ")}</span>}
          {showProgram && <span>·</span>}
          {dishwasherState === "clean" ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleDirty}
              className="text-accent-green"
            >
              Clean — tap to mark dirty
            </motion.button>
          ) : dishwasherState === "running" ? (
            <span className="text-accent">Cycle in progress</span>
          ) : (
            <span>Dirty</span>
          )}
          {cycles !== null && cycles > 0 && (
            <>
              <span>·</span>
              <span className="tabular-nums">{Math.round(cycles)} cycles</span>
            </>
          )}
        </div>

        {/* Progress — when running */}
        {isActive && (
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-accent-cool">
              <Icon icon="mdi:progress-clock" width={14} />
              <span className="font-medium">{phaseLabel}</span>
            </div>
            <span className="text-xs font-medium tabular-nums text-text-primary">
              {remaining !== null ? `${Math.round(remaining)} min left` : "—"}
            </span>
          </div>
        )}

        {/* Error */}
        {statusRaw === "error" && error && error !== "no_error" && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3 text-xs text-accent-red">
            <Icon icon="mdi:alert-circle" width={14} />
            Error: {error}
          </div>
        )}

        {/* Supply warnings */}
        {(saltLow || rinseAidLow) && (
          <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 text-xs text-accent-warm">
            {saltLow && (
              <span className="flex items-center gap-1">
                <Icon icon="mdi:shaker" width={13} />
                Salt low
              </span>
            )}
            {rinseAidLow && (
              <span className="flex items-center gap-1">
                <Icon icon="mdi:bottle-tonic" width={13} />
                Rinse aid low
              </span>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
