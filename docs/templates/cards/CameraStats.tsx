import { Icon } from "@iconify/react";

interface CameraStatsProps {
  battery: number | null;
  wifi: number | null;
  charging: string | undefined;
  lastPersonTime: string | null;
}

export function CameraStats({ battery, wifi, charging, lastPersonTime }: CameraStatsProps) {
  const batteryColor =
    battery === null
      ? "text-text-dim"
      : battery < 20
        ? "text-accent-red"
        : battery < 50
          ? "text-accent-warm"
          : "text-accent-green";

  return (
    <div className="grid grid-cols-4 gap-2 pb-3">
      <div className="rounded-xl bg-bg-elevated p-2.5">
        <div className="flex items-center gap-1 text-[10px] text-text-dim">
          <Icon icon="mdi:battery" width={12} />
          Battery
        </div>
        <p className={`mt-0.5 text-sm font-medium ${batteryColor}`}>
          {battery !== null ? `${Math.round(battery)}%` : "\u2014"}
        </p>
      </div>
      <div className="rounded-xl bg-bg-elevated p-2.5">
        <div className="flex items-center gap-1 text-[10px] text-text-dim">
          <Icon icon="mdi:wifi" width={12} />
          WiFi
        </div>
        <p className="mt-0.5 text-sm font-medium">
          {wifi !== null ? `${Math.round(wifi)} dBm` : "\u2014"}
        </p>
      </div>
      <div className="rounded-xl bg-bg-elevated p-2.5">
        <div className="flex items-center gap-1 text-[10px] text-text-dim">
          <Icon icon="mdi:lightning-bolt" width={12} />
          Charging
        </div>
        <p className="mt-0.5 text-sm font-medium capitalize">
          {charging && charging !== "unavailable" && charging !== "unknown"
            ? charging
            : "\u2014"}
        </p>
      </div>
      <div className="rounded-xl bg-bg-elevated p-2.5">
        <div className="flex items-center gap-1 text-[10px] text-text-dim">
          <Icon icon="mdi:account-eye" width={12} />
          Person
        </div>
        <p className="mt-0.5 text-sm font-medium">
          {lastPersonTime ?? "\u2014"}
        </p>
      </div>
    </div>
  );
}
