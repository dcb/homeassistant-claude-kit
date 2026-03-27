import { Icon } from "@iconify/react";
import { PopoverSelect } from "./PopoverSelect";
import type { Phase } from "../../lib/useControlCommit";

interface EffectsDropdownProps {
  effects: string[];
  current: string | undefined;
  phase?: Phase;
  onSelect: (effect: string) => void;
}

export function EffectsDropdown({
  effects,
  current,
  phase = "idle",
  onSelect,
}: EffectsDropdownProps) {
  const items = effects.map((effect) => ({ value: effect, label: effect }));

  return (
    <div className="flex items-center gap-2">
      <Icon icon="mdi:auto-fix" width={14} className="shrink-0 text-text-dim" />
      <PopoverSelect
        items={items}
        value={current}
        onSelect={onSelect}
        phase={phase}
        side="top"
        className="z-60 max-h-48 overflow-y-auto rounded-lg bg-bg-card shadow-lg ring-1 ring-white/10"
        itemClassName={(active) =>
          `block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
            active ? "text-accent" : "text-text-secondary"
          }`
        }
        trigger={
          <button
            className="flex flex-1 items-center gap-2 rounded-full bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10"
          >
            <span className="flex-1 truncate text-left text-text-secondary">
              {current ?? "No effect"}
            </span>
            <Icon icon="mdi:chevron-down" width={14} className="text-text-dim" />
          </button>
        }
      />
    </div>
  );
}
