import { lazy, Suspense, useState } from "react";
import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import type { RoomConfig } from "../../lib/areas";
import type { AcConfig } from "../../lib/acUnits";
import { parseNumericState } from "../../lib/format";
import { IconButton } from "../controls/IconButton";
import { Section, ToggleSwitch } from "./RoomPopupShared";
import { ROOM_ZONE_MAP } from "../../lib/entities";

const AcControlPopup = lazy(() =>
  import("./AcControlPopup").then((m) => ({ default: m.AcControlPopup })),
);

interface ClimateSectionProps {
  room: RoomConfig;
  entities: HassEntities;
  climateModeEntity: string;
  nextTransitionEntity: string;
  acUnits: AcConfig[];
}

export function ClimateSection({ room, entities, climateModeEntity, nextTransitionEntity, acUnits }: ClimateSectionProps) {
  const connection = useHass((s) => s.connection);
  const [acPopup, setAcPopup] = useState<AcConfig | null>(null);

  const zone = ROOM_ZONE_MAP[room.id];
  const climateMode = entities[climateModeEntity]?.state ?? "Off";
  const isClimateOff = climateMode === "Off";

  // Count active radiators (TRVs only — ACs shown separately)
  const radiators = room.climate?.filter((id) => id.includes("radiator")) ?? [];
  const activeRadiators = radiators.filter((id) => entities[id]?.state === "heat").length;
  const totalRadiators = radiators.length;

  // Current temperature and delta from target
  const currentTemp = zone ? parseNumericState(entities[zone.sensorId]?.state) : null;

  // Zone override state
  const overrideOn = zone ? entities[zone.overrideBoolean]?.state === "on" : false;
  const overrideTarget = zone ? parseNumericState(entities[zone.overrideTarget]?.state) : null;
  const effectiveTarget = zone ? parseNumericState(entities[zone.targetId]?.state) : null;

  // Delta from target
  const delta = currentTemp !== null && effectiveTarget !== null ? currentTemp - effectiveTarget : null;
  const onTarget = delta !== null && Math.abs(delta) <= 0.3;

  // Next scheduled transition
  const transitionSensor = entities[nextTransitionEntity];
  const transitionState = transitionSensor?.state;
  const transitionTarget = transitionSensor?.attributes?.target_temp as number | undefined;
  const transitionDesc = transitionSensor?.attributes?.description as string | undefined;
  const showTransition = climateMode === "Winter" && transitionState != null && transitionState !== "none";

  // Find AC config for this room
  const acConfig = zone?.acEntity
    ? acUnits.find((ac) => ac.entity === zone.acEntity)
    : undefined;
  const acEntity = acConfig ? entities[acConfig.entity] : undefined;
  const acAction = acEntity?.attributes?.hvac_action as string | undefined;
  const acIsManual = acConfig ? entities[acConfig.manualEntity]?.state === "on" : false;

  const showAc = acConfig && !isClimateOff;

  const toggleOverride = () => {
    if (!connection || !zone) return;
    callService(connection, "input_boolean", "toggle", {}, {
      entity_id: zone.overrideBoolean,
    });
  };

  const setOverrideTemp = (temp: number) => {
    if (!connection || !zone) return;
    callService(connection, "input_number", "set_value", { value: temp }, {
      entity_id: zone.overrideTarget,
    });
  };

  if (isClimateOff) {
    return (
      <Section title="Climate">
        <div className="rounded-xl bg-bg-elevated p-3 text-center text-xs text-text-dim">
          Climate mode is off
        </div>
      </Section>
    );
  }

  return (
    <Section title="Climate">
      <div className="space-y-2">
        {/* Zone status + override */}
        {zone && (
          <div className={`rounded-xl p-3 transition-colors ${
            overrideOn
              ? "bg-accent-warm/10 ring-1 ring-accent-warm/25"
              : "bg-bg-elevated"
          }`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{zone.name}</span>
                  {activeRadiators > 0 && (
                    <motion.span
                      className="flex items-center gap-1 text-xs text-accent-warm"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Icon icon="mdi:fire" width={12} />
                      Heating
                    </motion.span>
                  )}
                  {totalRadiators > 0 && (
                    <span className="flex items-center gap-1 text-xs text-text-dim">
                      <Icon icon="mdi:radiator" width={12} />
                      {activeRadiators}/{totalRadiators}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-dim capitalize">{climateMode} mode</span>
                {showTransition && transitionTarget != null && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-dim">
                    <Icon icon="mdi:clock-outline" width={11} />
                    <span>
                      {transitionDesc?.split(" (")[0]} at {transitionState} → {Number(transitionTarget).toFixed(1)}°
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                {effectiveTarget !== null && (
                  <div className="flex items-center justify-end gap-1 text-lg font-semibold tabular-nums">
                    <Icon icon="mdi:target" width={16} className="text-text-dim" />
                    {effectiveTarget.toFixed(1)}°
                  </div>
                )}
                {delta !== null && (
                  onTarget ? (
                    <span className="text-xs font-medium text-accent-green">on target</span>
                  ) : (
                    <span className={`text-xs font-medium ${delta > 0 ? "text-accent-warm" : "text-accent-cool"}`}>
                      {delta > 0 ? "+" : ""}{Math.abs(delta).toFixed(1)}° {delta > 0 ? "above" : "below"}
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Zone override */}
            {climateMode !== "Summer" && (
              <>
                <div className="mt-2 border-t border-white/5 pt-2">
                  <button
                    onClick={toggleOverride}
                    className="flex w-full items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Icon
                        icon={overrideOn ? "mdi:thermometer-high" : "mdi:thermometer-auto"}
                        width={16}
                        className={overrideOn ? "text-accent-warm" : "text-text-dim"}
                      />
                      <span className={overrideOn ? "font-medium text-accent-warm" : "text-text-secondary"}>
                        Zone Override
                      </span>
                    </div>
                    <ToggleSwitch isOn={overrideOn} color="bg-accent-warm" />
                  </button>
                </div>

                <AnimatePresence>
                  {overrideOn && overrideTarget !== null && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex items-center gap-3">
                        <IconButton
                          icon="mdi:minus"
                          iconSize={14}
                          variant="filled"
                          onClick={() => setOverrideTemp(Math.max(15, overrideTarget - 0.5))}
                          aria-label="Decrease temperature"
                        />
                        <div className="flex-1 text-center">
                          <span className="text-xl font-semibold tabular-nums text-accent-warm">
                            {overrideTarget.toFixed(1)}°
                          </span>
                        </div>
                        <IconButton
                          icon="mdi:plus"
                          iconSize={14}
                          variant="filled"
                          onClick={() => setOverrideTemp(Math.min(28, overrideTarget + 0.5))}
                          aria-label="Increase temperature"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        )}

        {/* AC control */}
        {showAc && acConfig && acEntity && (
          <button
            onClick={() => setAcPopup(acConfig)}
            className="flex w-full items-center justify-between rounded-xl bg-bg-elevated p-3 text-left hover:bg-white/8 active:bg-white/8"
          >
            <div>
              <div className="flex items-center gap-2">
                <Icon icon="mdi:air-conditioner" width={16} className="text-text-dim" />
                <span className="text-sm">{acConfig.label} AC</span>
                {acAction && acAction !== "idle" && acAction !== "off" && (
                  <span className={`text-xs capitalize ${
                    acAction === "heating" ? "text-accent-warm" : "text-accent-cool"
                  }`}>
                    {acAction}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-dim">
                {acIsManual ? "Manual control" : "Automatic"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {acEntity.state !== "off" && (
                <span className="text-sm tabular-nums">
                  {parseNumericState(acEntity.attributes?.temperature as string)?.toFixed(0)}°
                </span>
              )}
              <Icon icon="mdi:chevron-right" width={16} className="text-text-dim" />
            </div>
          </button>
        )}

      </div>

      {/* AC popup */}
      {acPopup && (
        <Suspense fallback={null}>
          <AcControlPopup
            ac={acPopup}
            open={!!acPopup}
            onClose={() => setAcPopup(null)}
          />
        </Suspense>
      )}
    </Section>
  );
}
