import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { Icon } from "@iconify/react";
import { parseNumericState } from "../../lib/format";
import type { AcConfig } from "../../lib/acUnits";
import { HVAC_META, FAN_META, SWING_META, getMeta } from "./ac-metadata";
import { SegmentedControl } from "../controls/SegmentedControl";
import { TemperatureControl } from "../controls/TemperatureControl";
import { useControlCommit } from "../../lib/useControlCommit";
import { useControlGroup } from "../../lib/useControlGroup";
import { BottomSheet } from "./BottomSheet";

interface AcControlPopupProps {
  ac: AcConfig;
  open: boolean;
  onClose: () => void;
}

// --- Main popup ---

export function AcControlPopup({ ac, open, onClose }: AcControlPopupProps) {
  return (
    <BottomSheet open={open} onClose={onClose} nested className="p-5 md:max-w-md">
      <AcControls ac={ac} />
    </BottomSheet>
  );
}

// --- Controls content ---

function AcControls({ ac }: { ac: AcConfig }) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);

  const entity = entities[ac.entity];
  const hvacMode = entity?.state ?? "off";
  const hvacAction = entity?.attributes?.hvac_action as string | undefined;
  const currentTemp = parseNumericState(entity?.attributes?.current_temperature as string | undefined);
  const targetTemp = parseNumericState(entity?.attributes?.temperature as string | undefined) ?? 22;
  const fanMode = (entity?.attributes?.fan_mode as string) ?? "";
  const swingMode = (entity?.attributes?.swing_mode as string) ?? "";
  const hvacModes = (entity?.attributes?.hvac_modes as string[]) ?? ["off"];
  const tempStep = (entity?.attributes?.target_temp_step as number) ?? 1;
  const minTemp = (entity?.attributes?.min_temp as number) ?? 16;
  const maxTemp = (entity?.attributes?.max_temp as number) ?? 32;
  const isManualServer = entities[ac.manualEntity]?.state === "on";

  // Shared group — freezes sibling controls when any is inflight on this entity
  const group = useControlGroup();

  // Control hooks
  const mode = useControlCommit(hvacMode, (v) => {
    if (!connection) return;
    if (v === "off") {
      callService(connection, "climate", "turn_off", {}, { entity_id: ac.entity });
    } else {
      callService(connection, "climate", "set_hvac_mode", { hvac_mode: v }, { entity_id: ac.entity });
    }
  }, { debounceMs: 300, group });

  const fan = useControlCommit(fanMode, (v) => {
    if (!connection) return;
    callService(connection, "climate", "set_fan_mode", { fan_mode: v }, { entity_id: ac.entity });
  }, { debounceMs: 300, group });

  const swing = useControlCommit(swingMode, (v) => {
    if (!connection) return;
    callService(connection, "climate", "set_swing_mode", { swing_mode: v }, { entity_id: ac.entity });
  }, { debounceMs: 300, group });

  const manual = useControlCommit(isManualServer, () => {
    if (!connection) return;
    callService(connection, "input_boolean", "toggle", {}, { entity_id: ac.manualEntity });
  }, { debounceMs: 200, group });

  const isOff = mode.displayValue === "off";
  const isManual = manual.displayValue;
  const isBusy = mode.phase !== "idle" || fan.phase !== "idle" || swing.phase !== "idle" || manual.phase !== "idle";

  // Timer remaining
  const timerE = entities[ac.timerEntity];
  const timerRemaining = isManual ? getTimerRemaining(timerE) : null;

  const hvacMeta = getMeta(HVAC_META, mode.displayValue);
  const actionLabel = hvacAction && hvacAction !== "idle" && hvacAction !== "off"
    ? hvacAction
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <DialogTitle className="text-base font-semibold">{ac.label}</DialogTitle>
        <DialogDescription className="sr-only">
          Air conditioning controls for {ac.label}
        </DialogDescription>
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-dim">{ac.sublabel}</p>
          {isBusy && (
            <span className="flex items-center gap-1 text-xs text-accent-warm">
              <Icon icon="mdi:loading" width={12} className="animate-spin" />
              Sending...
            </span>
          )}
        </div>
      </div>

      {/* Status row: current temp + mode + action */}
      <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">
            {currentTemp !== null ? `${currentTemp.toFixed(1)}°` : "—"}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-dim">
            <Icon icon={hvacMeta.icon} width={13} />
            <span className="capitalize">{hvacMeta.label}</span>
            {actionLabel && (
              <span className="capitalize text-text-secondary">· {actionLabel}</span>
            )}
          </div>
        </div>

        {/* Target temp with +/- (only when not off and manual) */}
        {!isOff && isManual && (
          <TemperatureControl
            value={targetTemp}
            min={minTemp}
            max={maxTemp}
            step={tempStep}
            group={group}
            onCommit={(temp) => {
              if (!connection) return;
              callService(connection, "climate", "set_temperature",
                { temperature: temp }, { entity_id: ac.entity });
            }}
          />
        )}

        {/* Read-only target in auto mode */}
        {!isOff && !isManual && (
          <div className="text-right">
            <div className="text-xl font-semibold tabular-nums">{targetTemp.toFixed(tempStep < 1 ? 1 : 0)}°</div>
            <div className="text-[10px] text-text-dim">Target</div>
          </div>
        )}
      </div>

      {/* Manual/Auto toggle */}
      <button
        onClick={() => manual.set(!manual.displayValue)}
        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors ${
          isManual
            ? "bg-accent-warm/15 text-accent-warm ring-1 ring-accent-warm/30"
            : "bg-bg-elevated text-text-secondary hover:bg-white/8"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon icon={isManual ? "mdi:hand-back-right" : "mdi:auto-fix"} width={18} />
          <span className="font-medium">{isManual ? "Manual control" : "Automatic"}</span>
        </div>
        <div className="flex items-center gap-2">
          {isManual && timerRemaining && (
            <span className="text-xs text-text-dim">{timerRemaining} left</span>
          )}
          <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${isManual ? "bg-accent-warm" : "bg-white/15"}`}>
            <motion.div
              className={`h-4 w-4 rounded-full bg-white shadow ${manual.phase === "inflight" ? "ring-2 ring-accent-warm/60 animate-spin" : ""}`}
              animate={{ x: isManual ? 16 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
        </div>
      </button>

      {/* Controls (only in manual mode) */}
      <AnimatePresence>
        {isManual && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 overflow-hidden"
          >
            {/* HVAC Mode */}
            <SegmentedControl
              label="Mode"
              value={mode.displayValue}
              phase={mode.phase}
              options={hvacModes.map((m) => {
                const meta = getMeta(HVAC_META, m);
                return { value: m, label: meta.label, icon: meta.icon };
              })}
              onChange={(v) => mode.set(v)}
            />

            {/* Fan Mode (when not off) */}
            {!isOff && ac.fanModes.length > 0 && (
              <SegmentedControl
                label="Fan"
                value={fan.displayValue}
                phase={fan.phase}
                options={ac.fanModes.map((m) => {
                  const meta = getMeta(FAN_META, m);
                  return { value: m, label: meta.label, icon: meta.icon };
                })}
                onChange={(v) => fan.set(v)}
              />
            )}

            {/* Swing Mode (when not off) */}
            {!isOff && ac.swingModes.length > 0 && (
              <SegmentedControl
                label="Swing"
                value={swing.displayValue}
                phase={swing.phase}
                options={ac.swingModes.map((m) => {
                  const meta = getMeta(SWING_META, m);
                  return { value: m, label: meta.label, icon: meta.icon };
                })}
                onChange={(v) => swing.set(v)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto mode info */}
      {!isManual && (
        <p className="text-center text-xs text-text-dim">
          Controlled by automations. Enable manual to take over.
        </p>
      )}
    </div>
  );
}

/** Extract remaining time from a timer entity. */
function getTimerRemaining(timerEntity: HassEntities[string] | undefined): string | null {
  if (!timerEntity || timerEntity.state !== "active") return null;
  const finishesAt = timerEntity.attributes?.finishes_at as string | undefined;
  if (!finishesAt) return null;
  const remaining = new Date(finishesAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
