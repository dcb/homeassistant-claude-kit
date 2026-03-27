import { parseNumericState } from "../lib/format";

export function Gauge({ label, value }: { label: string; value?: string }) {
  const pct = parseNumericState(value) ?? 0;
  const color =
    pct > 85 ? "bg-accent-red" : pct > 60 ? "bg-accent-warm" : "bg-accent-green";

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-xs text-text-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs text-text-secondary">
        {parseNumericState(value) !== null ? `${pct.toFixed(0)}%` : "\u2014"}
      </span>
    </div>
  );
}
