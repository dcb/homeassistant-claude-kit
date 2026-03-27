import { Icon } from "@iconify/react";
import { formatTimeAgo } from "../lib/format";
import { useHealthData } from "../hooks/useHealthData";
import { MONITORED_INTEGRATIONS } from "./health-constants";
import { BatteryRow } from "./BatteryRow";
import { Gauge } from "./Gauge";

export function SystemHealthView() {
  const {
    cpu,
    ram,
    disk,
    batteries,
    criticalBatteries,
    staleSensors,
    healthEvents,
    uptimeText,
    healthyCount,
    entities,
  } = useHealthData();

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">System Health</h1>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
          Admin
        </span>
      </div>

      {/* Integration status */}
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">
            Integrations
          </h2>
          <span
            className={`text-xs font-medium ${
              healthyCount === MONITORED_INTEGRATIONS.length
                ? "text-accent-green"
                : "text-accent-warm"
            }`}
          >
            {healthyCount} / {MONITORED_INTEGRATIONS.length}
          </span>
        </div>
        <div className="space-y-2">
          {MONITORED_INTEGRATIONS.map((integration) => {
            const entity = entities[integration.entity];
            const isOk =
              entity !== undefined &&
              entity.state !== "unavailable" &&
              entity.state !== "unknown";
            return (
              <div
                key={integration.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    icon={integration.icon}
                    width={16}
                    className={isOk ? "text-text-dim" : "text-accent-red"}
                  />
                  <span className="text-sm">{integration.name}</span>
                </div>
                <span
                  className={`text-xs font-medium ${
                    isOk ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {isOk ? "OK" : "Down"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stale sensors */}
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">
            Stale Sensors
          </h2>
          <span
            className={`text-xs font-medium ${
              staleSensors.length === 0 ? "text-accent-green" : "text-accent-warm"
            }`}
          >
            {staleSensors.length}
          </span>
        </div>
        {staleSensors.length === 0 ? (
          <p className="text-xs text-text-dim">
            All monitored sensors updating normally
          </p>
        ) : (
          <div className="space-y-2">
            {staleSensors.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:clock-alert-outline"
                    width={16}
                    className="text-accent-warm"
                  />
                  <span className="text-sm">{s.name}</span>
                </div>
                <span className="text-xs text-accent-warm">
                  {s.hoursAgo}h ago
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batteries */}
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">
            Batteries
          </h2>
          <span className="text-xs text-text-dim">
            {batteries.length} devices
          </span>
        </div>

        {criticalBatteries.length > 0 && (
          <div className="mb-3 rounded-xl bg-accent-red/10 p-3">
            <p className="mb-2 text-xs font-medium text-accent-red">
              Critical (&lt;20%)
            </p>
            <div className="space-y-2">
              {criticalBatteries.map((b) => (
                <BatteryRow key={b.entityId} battery={b} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {batteries
            .filter((b) => b.level >= 20)
            .map((b) => (
              <BatteryRow key={b.entityId} battery={b} />
            ))}
        </div>

        {batteries.length === 0 && (
          <p className="text-xs text-text-dim">No battery sensors found</p>
        )}
      </div>

      {/* System resources */}
      <div className="rounded-2xl bg-bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">
          Raspberry Pi
        </h2>
        <div className="space-y-3">
          <Gauge label="CPU" value={cpu} />
          <Gauge label="RAM" value={ram} />
          <Gauge label="Disk" value={disk} />
        </div>
        {uptimeText && (
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">
              <Icon
                icon="mdi:clock-check-outline"
                width={16}
                className="text-text-dim"
              />
              <span className="text-xs text-text-secondary">
                Uptime: {uptimeText.uptime}
              </span>
            </div>
            <span className="text-xs text-text-dim">
              Boot: {uptimeText.bootStr}
            </span>
          </div>
        )}
      </div>

      {/* Health events */}
      <div className="rounded-2xl bg-bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">
          Health Events
        </h2>
        {healthEvents.length === 0 ? (
          <p className="text-xs text-text-dim">No health automations found</p>
        ) : (
          <div className="space-y-2">
            {healthEvents.map((event) => (
              <div
                key={event.label}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      event.state === "on"
                        ? "bg-accent-green"
                        : "bg-text-dim"
                    }`}
                  />
                  <span className="text-sm">{event.label}</span>
                </div>
                <span className="text-xs text-text-dim">
                  {formatTimeAgo(event.triggered)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
