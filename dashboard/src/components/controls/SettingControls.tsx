import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { NumberConfig, BooleanConfig } from "../../lib/settings-types";
import { parseNumericState } from "../../lib/format";
import { useEntityState } from "../../lib/useEntityState";
import { useSliderControl } from "../../lib/useSliderControl";
import { useControlCommit } from "../../lib/useControlCommit";
import { SliderTrack } from "./SliderTrack";
import { TogglePill } from "./TogglePill";

// ── Collapsible section ────────────────────────────────────────────

interface SettingSectionProps {
  title: string;
  icon: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function SettingSection({ title, icon, defaultExpanded = false, children }: SettingSectionProps) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-sm font-medium text-text-secondary"
      >
        <Icon icon={icon} width={16} />
        {title}
        <Icon
          icon="mdi:chevron-down"
          width={16}
          className={`ml-auto transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="mt-2 text-xs font-medium text-text-dim first:mt-0">{title}</h3>
      {children}
    </div>
  );
}

// ── Help popover ───────────────────────────────────────────────────

interface HelpPopoverProps {
  text: string;
  range?: { min: number; max: number; step: number; unit: string };
}

export function HelpPopover({ text, range }: HelpPopoverProps) {
  return (
    <Popover.Root modal>
      <Popover.Trigger asChild>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-dim hover:text-text-secondary"
          aria-label="Help"
        >
          <Icon icon="mdi:help-circle-outline" width={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 max-w-72 rounded-xl bg-bg-card p-3 text-sm shadow-lg ring-1 ring-white/10 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <p className="text-text-secondary">{text}</p>
          {range && (
            <p className="mt-1.5 text-xs text-text-dim">
              Range: {range.min}–{range.max}{range.unit} (step {range.step})
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Row components ─────────────────────────────────────────────────

export function NumberRow({
  config,
  onChange,
}: {
  config: NumberConfig;
  onChange: (entityId: string, value: number) => void;
}) {
  const state = useEntityState(config.entity);
  const serverValue = parseNumericState(state) ?? config.min;
  const slider = useSliderControl(serverValue, (v) => onChange(config.entity, v), {
    min: config.min,
    max: config.max,
    step: config.step,
  });

  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2">
      <span className="min-w-28 text-sm">{config.label}</span>
      {config.help && <HelpPopover text={config.help} range={config} />}
      <SliderTrack
        slider={slider}
        formatValue={(v) => `${v}${config.unit}`}
      />
      <span className="w-16 text-right text-sm font-medium tabular-nums">
        {`${slider.displayValue}${config.unit}`}
      </span>
    </div>
  );
}

export function NumericInputRow({
  config,
  onChange,
}: {
  config: NumberConfig;
  onChange: (entityId: string, value: number) => void;
}) {
  const state = useEntityState(config.entity);
  const serverValue = parseNumericState(state) ?? config.min;

  const clampAndRound = (n: number): number => {
    const clamped = Math.min(config.max, Math.max(config.min, n));
    const decimals = (config.step.toString().split(".")[1] || "").length;
    return parseFloat(clamped.toFixed(decimals));
  };

  const { displayValue, phase, set, commit } = useControlCommit<number>(
    serverValue,
    (v) => onChange(config.entity, v),
  );

  const isPending = phase === "debouncing" || phase === "inflight";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2">
      <span className="min-w-28 text-sm">{config.label}</span>
      {config.help && <HelpPopover text={config.help} range={config} />}
      <div className="flex flex-1 items-center justify-end gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) set(clampAndRound(n));
          }}
          onBlur={() => commit()}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          className={`w-20 rounded-lg bg-white/10 px-2.5 py-1.5 text-right text-sm font-medium tabular-nums outline-none ring-1 transition-colors focus:ring-accent ${
            isPending
              ? "text-amber-400 ring-amber-400/40"
              : "text-text-primary ring-white/10"
          }`}
        />
        <span className="text-xs text-text-dim">{config.unit}</span>
      </div>
    </div>
  );
}

export function BooleanRow({
  config,
  onToggle,
}: {
  config: BooleanConfig;
  onToggle: (entityId: string) => void;
}) {
  const state = useEntityState(config.entity);
  const isOn = state === "on";
  const { displayValue, phase, set, commit } = useControlCommit<boolean>(
    isOn,
    () => onToggle(config.entity),
  );

  const handleToggle = () => {
    set(!displayValue);
    commit();
  };

  return (
    <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-3 py-2">
      <div className="flex items-center gap-1">
        <div>
          <span className="text-sm">{config.label}</span>
          {config.description && <p className="text-xs text-text-dim">{config.description}</p>}
        </div>
        {config.help && <HelpPopover text={config.help} />}
      </div>
      <TogglePill isOn={displayValue} onToggle={handleToggle} phase={phase} />
    </div>
  );
}

