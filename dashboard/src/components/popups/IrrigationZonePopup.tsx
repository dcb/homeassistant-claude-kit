import { useEffect, useLayoutEffect, useRef } from "react";
import { useHass } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import {
  effectiveCycleMinutes,
  irrigationZoneNumericParams,
  isIrrigationGroup,
  type IrrigationGroup,
  type IrrigationZoneConfig,
  type IrrigationZoneNumericParam,
} from "../../lib/entities";
import { parseNumericState } from "../../lib/format";
import { useControlCommit, type Phase } from "../../lib/useControlCommit";
import { useNumericControl, type NumericControlReturn } from "../../lib/useNumericControl";
import { useEntityState } from "../../lib/useEntityState";
import { IconButton } from "../controls/IconButton";
import { SegmentedControl } from "../controls/SegmentedControl";
import { BottomSheet } from "./BottomSheet";

interface IrrigationZonePopupProps {
  zone: IrrigationZoneConfig | null;
  open: boolean;
  onClose: () => void;
  /** True when any zone in either group has its sentinel on. Disables the group
   *  picker — the daily scheduler captures group helpers once at run start, so
   *  changing group during a run could silently break a future re-read. */
  anyZoneRunning: boolean;
}

export function IrrigationZonePopup({ zone, open, onClose, anyZoneRunning }: IrrigationZonePopupProps) {
  return (
    <BottomSheet open={open && !!zone} onClose={onClose} className="p-5 md:max-w-md">
      {zone && <IrrigationZoneSettings zone={zone} anyZoneRunning={anyZoneRunning} />}
    </BottomSheet>
  );
}

function IrrigationZoneSettings({
  zone,
  anyZoneRunning,
}: {
  zone: IrrigationZoneConfig;
  anyZoneRunning: boolean;
}) {
  const connection = useHass((s) => s.connection);
  const params = irrigationZoneNumericParams(zone);

  // Numeric controls — each owns its own commit lifecycle.
  // No shared useControlGroup: distinct entities, no sibling-flicker risk.
  // holdMs: 500 instead of the 3 s default — HA-side helpers echo back in ~50 ms
  // with no device revert; 3 s would visibly freeze the stepper between rapid taps.
  const cycleServer   = parseNumericState(useEntityState(zone.cycleMinutes)) ?? params.cycleMinutes.fallback;
  const cyclesServer  = parseNumericState(useEntityState(zone.cycles))       ?? params.cycles.fallback;
  const soakServer    = parseNumericState(useEntityState(zone.soakMinutes))  ?? params.soakMinutes.fallback;
  const seasonalServer = parseNumericState(useEntityState(zone.seasonalPct)) ?? params.seasonalPct.fallback;

  const cycleCtrl = useNumericControl(
    cycleServer,
    (v) => { if (connection) callService(connection, "input_number", "set_value", { value: v }, { entity_id: zone.cycleMinutes }); },
    { min: params.cycleMinutes.min, max: params.cycleMinutes.max, step: params.cycleMinutes.step, debounceMs: 300, holdMs: 500 },
  );
  const cyclesCtrl = useNumericControl(
    cyclesServer,
    (v) => { if (connection) callService(connection, "input_number", "set_value", { value: v }, { entity_id: zone.cycles }); },
    { min: params.cycles.min, max: params.cycles.max, step: params.cycles.step, debounceMs: 300, holdMs: 500 },
  );
  const soakCtrl = useNumericControl(
    soakServer,
    (v) => { if (connection) callService(connection, "input_number", "set_value", { value: v }, { entity_id: zone.soakMinutes }); },
    { min: params.soakMinutes.min, max: params.soakMinutes.max, step: params.soakMinutes.step, debounceMs: 300, holdMs: 500 },
  );
  const seasonalCtrl = useNumericControl(
    seasonalServer,
    (v) => { if (connection) callService(connection, "input_number", "set_value", { value: v }, { entity_id: zone.seasonalPct }); },
    { min: params.seasonalPct.min, max: params.seasonalPct.max, step: params.seasonalPct.step, debounceMs: 300, holdMs: 500 },
  );

  // Group picker — typed literal so `set()` rejects anything other than front/back.
  const groupRaw = useEntityState(zone.group);
  const groupServer: IrrigationGroup = isIrrigationGroup(groupRaw) ? groupRaw : zone.defaultGroup;
  const groupCtrl = useControlCommit<IrrigationGroup>(
    groupServer,
    (v) => { if (connection) callService(connection, "input_select", "select_option", { option: v }, { entity_id: zone.group }); },
    { debounceMs: 300, holdMs: 500 },
  );

  // Live "X min effective" — reads displayValue (debouncing-aware), not raw state.
  const effective = effectiveCycleMinutes(cycleCtrl.displayValue, seasonalCtrl.displayValue);

  // Flush pending debounces on unmount so a swipe-to-dismiss mid-edit doesn't
  // silently drop the user's last change. Hooks return fresh objects each render,
  // so we keep latest commit refs alive and call them once on cleanup.
  // callService is fire-and-forget at the WebSocket layer — requests survive
  // the popup unmounting.
  const commitsRef = useRef<Array<() => void>>([]);
  useLayoutEffect(() => {
    commitsRef.current = [
      cycleCtrl.commit, cyclesCtrl.commit, soakCtrl.commit, seasonalCtrl.commit, groupCtrl.commit,
    ];
  });
  useEffect(() => () => { commitsRef.current.forEach((c) => c()); }, []);

  const groupColor = groupCtrl.displayValue === "front"
    ? "bg-accent-blue/20 text-accent-blue"
    : "bg-accent-green/20 text-accent-green";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <DialogTitle className="text-base font-semibold truncate">{zone.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Settings for {zone.name} irrigation zone
          </DialogDescription>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${groupColor}`}>
            {groupCtrl.displayValue}
          </span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-text-dim">
          {effective} min effective
        </span>
      </div>

      {/* Stepper rows — data-no-drag so finger drift on +/- doesn't trigger
          BottomSheet's swipe-to-dismiss. */}
      <div data-no-drag className="space-y-1.5">
        <StepperRow control={cycleCtrl} param={params.cycleMinutes} />
        <StepperRow control={cyclesCtrl} param={params.cycles} />
        <StepperRow control={soakCtrl} param={params.soakMinutes} />
        <StepperRow control={seasonalCtrl} param={params.seasonalPct} />
      </div>

      {/* Group picker. Disabled during a run to avoid racing the scheduler,
          which captures every zone's group once at run start. */}
      <div data-no-drag>
        <SegmentedControl
          label={anyZoneRunning ? "Group (locked while irrigation is running)" : "Group"}
          value={anyZoneRunning ? groupServer : groupCtrl.displayValue}
          phase={anyZoneRunning ? "idle" : groupCtrl.phase}
          onChange={(v) => {
            if (anyZoneRunning) return;
            if (v === "front" || v === "back") groupCtrl.set(v);
          }}
          options={[
            { value: "front", label: "Front", icon: "mdi:home-outline" },
            { value: "back", label: "Back", icon: "mdi:tree-outline" },
          ]}
        />
      </div>
    </div>
  );
}

interface StepperRowProps {
  control: NumericControlReturn;
  param: IrrigationZoneNumericParam;
}

function StepperRow({ control, param }: StepperRowProps) {
  const decimals = param.step < 1 ? 1 : 0;
  const phase: Phase = control.phase;
  const valueClass = phase === "idle" ? "text-text-primary" : "text-accent-warm";
  const shakeClass = phase === "correction" ? "animate-shake" : "";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2">
      <span className="flex-1 text-sm text-text-secondary">{param.label}</span>
      <IconButton
        icon="mdi:minus"
        variant="ghost"
        shape="lg"
        iconSize={16}
        onClick={control.decrement}
        aria-label={`Decrease ${param.label}`}
      />
      <span className={`min-w-[3.5rem] text-right text-base font-semibold tabular-nums transition-colors duration-300 ${valueClass} ${shakeClass}`}>
        {control.displayValue.toFixed(decimals)}
        {param.unit && <span className="ml-0.5 text-xs font-normal text-text-dim">{param.unit.trim()}</span>}
      </span>
      <IconButton
        icon="mdi:plus"
        variant="ghost"
        shape="lg"
        iconSize={16}
        onClick={control.increment}
        aria-label={`Increase ${param.label}`}
      />
    </div>
  );
}
