import type { BatteryInfo } from "./health-constants";

export function BatteryRow({ battery }: { battery: BatteryInfo }) {
  const color =
    battery.level < 20
      ? "bg-accent-red"
      : battery.level < 50
        ? "bg-accent-warm"
        : "bg-accent-green";
  const textColor =
    battery.level < 20
      ? "text-accent-red"
      : battery.level < 50
        ? "text-accent-warm"
        : "text-text-secondary";

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-xs">{battery.name}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${battery.level}%` }}
        />
      </div>
      <span className={`w-8 text-right text-xs font-medium ${textColor}`}>
        {battery.level}%
      </span>
    </div>
  );
}
