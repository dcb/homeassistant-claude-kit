import { DayPicker, type DateRange } from "react-day-picker";
import * as Popover from "@radix-ui/react-popover";
import { Icon } from "@iconify/react";

import "react-day-picker/style.css";

interface DateRangePickerProps {
  from: Date;
  to: Date;
  onChange: (range: { from: Date; to: Date }) => void;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const selected: DateRange = { from, to };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) return;
    if (range.from && range.to) {
      onChange({ from: range.from, to: range.to });
    } else if (range.from) {
      // Single date clicked — set both from and to
      onChange({ from: range.from, to: range.from });
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-bg-elevated px-2.5 py-1 text-sm text-text-primary hover:bg-white/10 active:bg-white/10">
          <Icon icon="mdi:calendar-range" width={14} className="text-text-dim" />
          <span>{formatShort(from)}</span>
          <span className="text-text-dim">–</span>
          <span>{formatShort(to)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[60] rounded-xl bg-bg-card p-3 shadow-xl ring-1 ring-white/10"
        >
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
            showOutsideDays
            classNames={{
              root: "rdp-custom",
              months: "flex gap-4",
              month_caption: "flex justify-center items-center h-8 text-sm font-medium text-text-primary",
              nav: "flex items-center",
              button_previous: "absolute left-2 top-2 p-1 rounded-md text-text-dim hover:bg-white/10 active:bg-white/10",
              button_next: "absolute right-2 top-2 p-1 rounded-md text-text-dim hover:bg-white/10 active:bg-white/10",
              weekdays: "flex",
              weekday: "w-9 text-center text-xs text-text-dim font-medium",
              week: "flex",
              day: "w-9 h-8 text-center text-sm",
              day_button: "w-full h-full rounded-md hover:bg-white/10 active:bg-white/10 text-text-primary",
              today: "font-bold text-accent",
              selected: "!bg-accent !text-white rounded-md",
              range_start: "!bg-accent !text-white rounded-l-md rounded-r-none",
              range_end: "!bg-accent !text-white rounded-r-md rounded-l-none",
              range_middle: "!bg-accent/20 !text-text-primary rounded-none",
              outside: "text-text-dim/40",
              disabled: "text-text-dim/20",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
