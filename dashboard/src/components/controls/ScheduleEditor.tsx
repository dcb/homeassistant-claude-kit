import { useHass } from "@hakit/core";
import type { HassEntities } from "home-assistant-js-websocket";
import { callService } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { useControlCommit } from "../../lib/useControlCommit";
import type { ScheduleEditorConfig } from "../../lib/entities";

export function ScheduleEditor({ config }: { config: ScheduleEditorConfig }) {
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Icon icon="mdi:calendar-clock" width={16} />
        Schedules
      </h2>
      <div className="space-y-4">
        {config.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-xs font-medium text-text-dim">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((s) => (
                <TimeRow
                  key={s.entity}
                  entityId={s.entity}
                  label={s.label}
                  icon={s.icon}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeRow({
  entityId,
  label,
  icon,
}: {
  entityId: string;
  label: string;
  icon: string;
}) {
  const entities = useHass((s) => s.entities) as HassEntities;
  const connection = useHass((s) => s.connection);
  const serverTime = entities[entityId]?.state ?? "";
  // HA input_datetime stores as "HH:MM:SS", input type="time" uses "HH:MM"
  const serverShort = serverTime.length >= 5 ? serverTime.slice(0, 5) : "";

  const control = useControlCommit<string>(
    serverShort,
    (time) => {
      if (!connection) return;
      callService(connection, "input_datetime", "set_datetime", { time: time + ":00" }, { entity_id: entityId });
    },
    { debounceMs: 500 },
  );

  const phaseClass =
    control.phase === "inflight" ? "ring-1 ring-accent-warm/50 animate-text-glow" :
    control.phase === "debouncing" ? "ring-1 ring-accent-warm/30" :
    control.phase === "correction" ? "animate-shake" : "";

  return (
    <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} width={16} className="text-text-dim" />
        <span className="text-sm">{label}</span>
      </div>
      <input
        type="time"
        value={control.displayValue}
        onChange={(e) => control.set(e.target.value)}
        className={`rounded-lg bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent transition-all ${phaseClass}`}
      />
    </div>
  );
}
