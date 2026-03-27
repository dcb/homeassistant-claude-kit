import { useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { toDateStr } from "../../lib/date-utils";

export interface DateNavigatorProps {
  dateStr: string;
  onDateChange: (newDateStr: string) => void;
  formatLabel?: (dateStr: string) => string;
}

function defaultFormatLabel(dateStr: string): string {
  const now = new Date();
  if (toDateStr(now) === dateStr) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (toDateStr(yesterday) === dateStr) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DateNavigator({
  dateStr,
  onDateChange,
  formatLabel = defaultFormatLabel,
}: DateNavigatorProps) {
  const isToday = useMemo(() => toDateStr(new Date()) === dateStr, [dateStr]);

  const navigate = useCallback(
    (delta: number) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      onDateChange(toDateStr(new Date(y, m - 1, d + delta)));
    },
    [dateStr, onDateChange],
  );

  const label = useMemo(() => formatLabel(dateStr), [formatLabel, dateStr]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        className="rounded-full p-1 text-text-secondary transition-colors hover:bg-bg-elevated active:bg-bg-elevated"
      >
        <Icon icon="mdi:chevron-left" width={18} />
      </button>
      <span className="min-w-[100px] text-center text-xs font-medium text-text-secondary">
        {label}
      </span>
      <button
        onClick={() => navigate(1)}
        disabled={isToday}
        className="rounded-full p-1 text-text-secondary transition-colors hover:bg-bg-elevated active:bg-bg-elevated disabled:opacity-30"
      >
        <Icon icon="mdi:chevron-right" width={18} />
      </button>
    </div>
  );
}
