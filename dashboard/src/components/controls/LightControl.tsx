import { useState, useCallback } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { haIconToIconify } from "../../lib/icons";
import { IconButton } from "./IconButton";
import { TogglePill } from "./TogglePill";
import { SliderRow } from "./SliderRow";
import { ColorPickerPopup } from "./ColorPickerPopup";
import { EffectsDropdown } from "./EffectsDropdown";
import { lightColor } from "./light-colors";
import { useControlCommit } from "../../lib/useControlCommit";
import { useControlGroup } from "../../lib/useControlGroup";

// Re-export color utilities so existing imports from LightControl keep working
export { kelvinToRgb, lightColor } from "./light-colors";

interface LightControlProps {
  entityId: string;
  /** Prefix to strip from friendly_name (e.g. "Living Room") */
  stripPrefix?: string;
}

// --- Main component ---

export function LightControl({ entityId, stripPrefix }: LightControlProps) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);

  // Color picker popup
  const [pickerOpen, setPickerOpen] = useState(false);

  // Derive entity attribute values
  const entity = entities[entityId];
  const entityIsOn = entity?.state === "on";
  const entityColorTemp = entity?.attributes?.color_temp_kelvin as number | undefined;
  const entityRgb = entity?.attributes?.rgb_color as [number, number, number] | undefined;
  const entityEffect = entity?.attributes?.effect as string | undefined;

  // Shared group — all controls on this entity freeze siblings during inflight
  const group = useControlGroup();

  // Per-field useControlCommit for power toggle
  const powerControl = useControlCommit<boolean>(
    entityIsOn,
    (value) => {
      if (!connection) return;
      const domain = entityId.split(".")[0];
      callService(connection, domain, value ? "turn_on" : "turn_off", undefined, { entity_id: entityId });
    },
    { debounceMs: 0, group },
  );

  // Per-field useControlCommit for effect
  const effectControl = useControlCommit<string>(
    entityEffect ?? "",
    (effect) => {
      if (!connection) return;
      callService(connection, "light", "turn_on", { effect }, { entity_id: entityId });
    },
    { debounceMs: 0, group },
  );

  // Service calls for brightness, colorTemp, and rgb
  // (SliderRow handles its own pending state internally via useSliderControl)
  const changeBrightness = useCallback((pct: number) => {
    if (!connection) return;
    callService(connection, "light", "turn_on", { brightness_pct: pct }, { entity_id: entityId });
  }, [connection, entityId]);

  const changeColorTemp = useCallback((kelvin: number) => {
    if (!connection) return;
    callService(connection, "light", "turn_on", { color_temp_kelvin: kelvin }, { entity_id: entityId });
  }, [connection, entityId]);

  const changeRgb = useCallback((rgb: [number, number, number]) => {
    if (!connection) return;
    callService(connection, "light", "turn_on", { rgb_color: rgb }, { entity_id: entityId });
  }, [connection, entityId]);

  if (!entity) return null;

  const domain = entityId.split(".")[0];
  const isSwitch = domain === "switch";
  const isUnavailable = entity.state === "unavailable" || entity.state === "unknown";

  const isOn = powerControl.displayValue;
  const hasPending = powerControl.phase !== "idle" || effectControl.phase !== "idle";

  // Entity icon
  const entityIcon = haIconToIconify((entity.attributes?.icon as string) ?? "mdi:lightbulb");

  const friendlyName = (entity.attributes?.friendly_name as string) ?? entityId.split(".")[1];
  const stripped = stripPrefix
    ? friendlyName.replace(new RegExp(`^${stripPrefix}\\s*`, "i"), "")
    : friendlyName;
  const rawName = stripped || friendlyName;
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Light capabilities
  const supportedModes = (entity.attributes?.supported_color_modes as string[]) ?? [];
  const hasColorTemp = supportedModes.includes("color_temp");
  const hasRgb =
    supportedModes.includes("xy") ||
    supportedModes.includes("rgb") ||
    supportedModes.includes("rgbw") ||
    supportedModes.includes("rgbww") ||
    supportedModes.includes("hs");
  const hasBrightness = !isSwitch && supportedModes.some((m) => m !== "onoff");
  const effectList = (entity.attributes?.effect_list as string[]) ?? [];
  const hasEffects = effectList.length > 0;
  const currentColorMode = entity.attributes?.color_mode as string | undefined;

  // Display values — SliderRow manages its own pending state internally
  const brightness = (entity.attributes?.brightness as number) ?? 0;
  const brightnessPct = Math.round((brightness / 255) * 100);
  const minKelvin = (entity.attributes?.min_color_temp_kelvin as number) ?? 2000;
  const maxKelvin = (entity.attributes?.max_color_temp_kelvin as number) ?? 6535;
  // Kelvin comparison in mired space: HA stores color temp as integer mireds,
  // so kelvin→mired→kelvin round-trips can differ by up to ~50K at high kelvin
  const kelvinEqual = useCallback((a: number, b: number) => {
    if (a <= 0 || b <= 0) return a === b;
    return Math.abs(Math.round(1_000_000 / a) - Math.round(1_000_000 / b)) <= 2;
  }, []);
  const displayColorTemp = entityColorTemp ?? Math.round((minKelvin + maxKelvin) / 2);
  const displayRgb = entityRgb;
  const displayEffect = effectControl.displayValue || entityEffect;
  const iconColor = lightColor(isOn, displayRgb, displayColorTemp);

  const toggle = () => {
    if (isUnavailable) return;
    powerControl.set(!isOn);
  };

  // --- Unavailable state ---
  if (isUnavailable) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-3 opacity-50">
        <div className="flex items-center gap-2">
          <Icon icon={entityIcon} width={18} className="text-text-dim" />
          <span className="text-sm text-text-dim">{name}</span>
        </div>
        <span className="text-xs text-accent-red">Unavailable</span>
      </div>
    );
  }

  // --- Switch entity: toggle only ---
  if (isSwitch) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-bg-elevated p-3">
        <button onClick={toggle} className="flex items-center gap-2">
          <Icon icon={entityIcon} width={18} style={isOn ? { color: "rgb(255,180,80)" } : undefined} className={!isOn ? "text-text-dim" : undefined} />
          <span className="text-sm">{name}</span>
        </button>
        <TogglePill isOn={isOn} onToggle={toggle} />
      </div>
    );
  }

  // --- Full light control ---
  return (
    <div className="overflow-hidden rounded-xl bg-bg-elevated">
      {/* Header: icon + name + brightness% + toggle */}
      <div className={`flex items-center justify-between px-3 ${isOn ? "pt-3 pb-1" : "py-3"}`}>
        <button onClick={toggle} className="flex items-center gap-2 min-w-0">
          <motion.div
            animate={hasPending ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={hasPending ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.15 }}
          >
            <Icon icon={entityIcon} width={18} style={iconColor ? { color: iconColor } : undefined} className={iconColor ? "glow-light" : "text-text-dim"} />
          </motion.div>
          <span className="truncate text-sm">{name}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {isOn && hasBrightness && (
            <span className="text-xs tabular-nums text-text-dim">{brightnessPct}%</span>
          )}
          <TogglePill isOn={isOn} onToggle={toggle} />
        </div>
      </div>

      {/* Controls — only when on */}
      <AnimatePresence>
        {isOn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
              {/* Brightness slider */}
              {hasBrightness && (
                <SliderRow
                  icon="mdi:brightness-6"
                  value={brightnessPct}
                  min={1}
                  max={100}
                  group={group}
                  onCommit={changeBrightness}
                  trackGradient="linear-gradient(to right, var(--color-surface-dim), var(--color-accent-warm))"
                />
              )}

              {/* Color temperature + color picker button */}
              {hasColorTemp && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SliderRow
                      icon="mdi:thermometer"
                      value={displayColorTemp}
                      min={minKelvin}
                      max={maxKelvin}
                      isEqual={kelvinEqual}
                      group={group}
                      onCommit={changeColorTemp}
                      trackGradient="linear-gradient(to right, var(--color-accent-warm), var(--color-accent-cool-light))"
                      formatValue={(v) => `${Math.round(v)}K`}
                      dimmed={currentColorMode !== "color_temp"}
                    />
                  </div>
                  {hasRgb && (
                    <IconButton
                      variant="ghost"
                      onClick={() => setPickerOpen(true)}
                      aria-label="Color picker"
                    >
                      <div
                        className="h-5 w-5 rounded-full ring-2 ring-white/20"
                        style={{
                          background: displayRgb
                            ? `rgb(${displayRgb[0]},${displayRgb[1]},${displayRgb[2]})`
                            : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                        }}
                      />
                    </IconButton>
                  )}
                </div>
              )}

              {/* RGB-only lights without color temp */}
              {hasRgb && !hasColorTemp && (
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:palette" width={14} className="shrink-0 text-text-dim" />
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex flex-1 items-center gap-2 rounded-full bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10 active:bg-white/10"
                  >
                    <div
                      className="h-4 w-4 rounded-full ring-1 ring-white/20"
                      style={{
                        background: displayRgb
                          ? `rgb(${displayRgb[0]},${displayRgb[1]},${displayRgb[2]})`
                          : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                      }}
                    />
                    <span className="text-text-secondary">
                      {displayRgb ? `${displayRgb[0]}, ${displayRgb[1]}, ${displayRgb[2]}` : "Choose color"}
                    </span>
                  </button>
                </div>
              )}

              {/* Effects dropdown */}
              {hasEffects && (
                <EffectsDropdown
                  effects={effectList}
                  current={displayEffect}
                  phase={effectControl.phase}
                  onSelect={(effect) => effectControl.set(effect)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color picker popup */}
      {hasRgb && (
        <ColorPickerPopup
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          currentRgb={displayRgb ?? [255, 255, 255]}
          onChange={changeRgb}
        />
      )}
    </div>
  );
}
