export interface RuntimeItem {
  label: string;
  ms: number;
}

export interface RuntimeSummaryProps {
  items: RuntimeItem[];
  yAxisWidth: number;
}

function formatRuntime(ms: number): string {
  if (ms <= 0) return "";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function RuntimeSummary({ items, yAxisWidth }: RuntimeSummaryProps) {
  const active = items.filter((i) => i.ms > 0);
  if (active.length === 0) return null;
  return (
    <div
      className="mt-1 flex gap-3 text-[10px] text-text-dim"
      style={{ marginLeft: yAxisWidth }}
    >
      {active.map((i) => (
        <span key={i.label}>
          {i.label}{" "}
          <span className="tabular-nums text-text-secondary">
            {formatRuntime(i.ms)}
          </span>
        </span>
      ))}
    </div>
  );
}
