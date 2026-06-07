import { Suspense, lazy, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useHass } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import type { HassEntities } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import { PopoverSelect } from "../components/controls/PopoverSelect";

const IrrigationZonePopup = lazy(() =>
  import("../components/popups/IrrigationZonePopup").then((m) => ({ default: m.IrrigationZonePopup })),
);
import {
  IRRIGATION_ZONES,
  IRRIGATION_FREQUENCY,
  IRRIGATION_SKIP_ANY,
  IRRIGATION_SKIP_RAIN_FORECAST,
  IRRIGATION_SKIP_RAIN_ACTUAL,
  IRRIGATION_SKIP_WIND,
  IRRIGATION_SKIP_FREEZE,
  IRRIGATION_SKIP_SEASONAL_COLD,
  IRRIGATION_LAST_RUN_STATUS,
  IRRIGATION_LAST_RUN_DETAILS,
  IRRIGATION_RAIN_YESTERDAY,
  IRRIGATION_RAIN_TODAY,
  IRRIGATION_PRECIP_FORECAST_24H,
  IRRIGATION_MANUAL_STOP,
  IRRIGATION_PAUSE_DAYS,
  IRRIGATION_PAUSE_UNTIL,
  IRRIGATION_HEAT_BOOST,
  IRRIGATION_CONNECTIVITY,
  IRRIGATION_RUN_NOW,
  IRRIGATION_TEMP_3_DAY_AVG,
  OUTDOOR_TEMP,
  WEATHER,
  IRRIGATION_RAIN_HISTORY_SKIP_MM,
  IRRIGATION_RAIN_SKIP_MM,
  IRRIGATION_WIND_SKIP_KMH,
  IRRIGATION_FREEZE_TEMP,
  IRRIGATION_SEASONAL_COLD_TEMP,
  effectiveCycleMinutes,
  type IrrigationZoneConfig,
} from "../lib/entities";
import { useEntityState } from "../lib/useEntityState";
import { useMinuteTick } from "../hooks/useMinuteTick";
import { useIrrigationRuns, type IrrigationRun } from "../hooks/useIrrigationRuns";

// ─── Zone Card ──────────────────────────────────────────────────────

interface ZoneCardProps {
  zone: IrrigationZoneConfig;
  schedulerRunning: boolean;
  lastRun: IrrigationRun | null;
  onOpenSettings: () => void;
}

/** Wrap a click handler so the parent card's onClick doesn't also fire. */
function stopProp(fn: () => void) {
  return (e: MouseEvent) => { e.stopPropagation(); fn(); };
}

function formatElapsed(startIso: string | undefined, now: number): string {
  if (!startIso) return "0s";
  const elapsedSec = Math.max(0, Math.round((now - new Date(startIso).getTime()) / 1000));
  if (elapsedSec < 60) return `${elapsedSec}s`;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatLastRun(run: IrrigationRun | null): string {
  if (!run) return "Never run";
  const minutes = Math.max(1, Math.round(run.durationMs / 60000));
  const startedAt = new Date(run.startedAt);
  const now = new Date();
  const startedDay = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((today.getTime() - startedDay.getTime()) / 86400000);
  const hhmm = startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dayDiff === 0) return `Today ${hhmm}, ${minutes}m`;
  if (dayDiff === 1) return `Yesterday ${hhmm}, ${minutes}m`;
  if (dayDiff < 7) return `${dayDiff}d ago, ${minutes}m`;
  const md = startedAt.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${md}, ${minutes}m`;
}

function ZoneCard({ zone, schedulerRunning, lastRun, onOpenSettings }: ZoneCardProps) {
  const connection = useHass((s) => s.connection);
  const entities = useHass((s) => s.entities) as HassEntities;

  const runningEntity = entities[zone.running];
  const wateringEntity = entities[zone.watering];
  const valveEntity = entities[zone.valve];
  const isRunning = runningEntity?.state === "on";
  const valveState = valveEntity?.state;
  const valveOpen = valveState === "open";
  const wateringNow = wateringEntity?.state === "on";
  const enabled = entities[zone.enabled]?.state === "on";
  const group = entities[zone.group]?.state ?? zone.defaultGroup;
  const cycleMin = Number(entities[zone.cycleMinutes]?.state) || 0;
  const cycles = Number(entities[zone.cycles]?.state) || 1;
  const seasonalPct = Number(entities[zone.seasonalPct]?.state) || 100;
  const soakMin = Number(entities[zone.soakMinutes]?.state) || 0;
  const effectiveMin = effectiveCycleMinutes(cycleMin, seasonalPct);

  // Tick every 10s while running so the progress bar moves smoothly even
  // for short (sub-minute) elapsed times.
  const now = useMinuteTick(isRunning, 10_000);
  const startIso = runningEntity?.last_changed;
  const elapsed = isRunning ? formatElapsed(startIso, now) : null;
  // Total expected runtime for this zone: cycles × per-cycle minutes,
  // plus soak between cycles.
  const totalMs = (effectiveMin * cycles + Math.max(0, cycles - 1) * soakMin) * 60_000;
  const elapsedMs = isRunning && startIso
    ? Math.max(0, now - new Date(startIso).getTime())
    : 0;
  const progressPct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  // Some valve controllers poll the cloud every ~minute, so right after
  // start_watering the valve may still read 'closed' for up to 60s. Trust the
  // valve OR watering sensor for "actively watering". When neither is on but
  // the sentinel is, we're either pre-start (lag) or in a between-cycles soak —
  // only the latter applies for multi-cycle zones.
  const phase = isRunning
    ? (valveOpen || wateringNow ? "Watering" : (cycles > 1 ? "Soaking" : "Starting"))
    : null;

  // Start is disabled during an active scheduler run — no manual
  // interference while auto is running. Stop always remains available.
  const startDisabled = !enabled || schedulerRunning;

  const handleStart = () => {
    if (!connection) return;
    callService(connection, "input_boolean", "turn_on", {}, { entity_id: zone.manualRun });
  };

  const handleStop = () => {
    if (!connection) return;
    // Clearing the sentinel breaks the zone's cycle loop; closing the
    // valve is a belt-and-suspenders so the hardware stops immediately
    // instead of waiting for the wait_template to notice.
    callService(connection, "input_boolean", "turn_off", {}, { entity_id: zone.running });
    callService(connection, "valve", "close_valve", {}, { entity_id: zone.valve });
  };

  const handleToggleEnabled = () => {
    if (!connection) return;
    callService(connection, "input_boolean", "toggle", {}, { entity_id: zone.enabled });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenSettings();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenSettings}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer rounded-2xl bg-bg-card p-4 transition-colors hover:bg-bg-card/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isRunning ? "ring-1 ring-accent-cool/50" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-sm font-medium truncate">{zone.name}</h3>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          group === "front" ? "bg-accent-blue/20 text-accent-blue" : "bg-accent-green/20 text-accent-green"
        }`}>
          {group}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {isRunning ? (
            <button
              onClick={stopProp(handleStop)}
              className="rounded-lg p-1.5 transition-colors hover:bg-accent-red/20"
              title="Stop"
            >
              <Icon icon="mdi:stop-circle" width={20} className="text-accent-red" />
            </button>
          ) : (
            <button
              onClick={stopProp(handleStart)}
              disabled={startDisabled}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10 disabled:opacity-30"
              title={schedulerRunning ? "Auto run in progress" : "Manual run"}
            >
              <Icon icon="mdi:play-circle-outline" width={20} className="text-accent-cool" />
            </button>
          )}
          <button
            onClick={stopProp(handleToggleEnabled)}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            title={enabled ? "Disable zone" : "Enable zone"}
          >
            <Icon
              icon={enabled ? "mdi:sprinkler-variant" : "mdi:sprinkler-off"}
              width={20}
              className={enabled ? "text-accent-green" : "text-text-dim"}
            />
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-text-dim truncate">
          {isRunning
            ? `${phase} — ${elapsed}`
            : `${effectiveMin} min (${cycleMin}×${seasonalPct}%)`}
        </p>
        <Icon icon="mdi:chevron-right" width={14} className="shrink-0 text-text-dim/50" />
      </div>
      {!isRunning && (
        <p className="mt-0.5 text-[11px] text-text-dim/70">
          {formatLastRun(lastRun)}
        </p>
      )}
      {isRunning && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full animate-pulse rounded-full bg-accent-cool transition-[width] duration-700 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Skip Condition Row ─────────────────────────────────────────────

function SkipRow({ label, entity, value }: { label: string; entity: string; value: string }) {
  const state = useEntityState(entity);
  const isSkip = state === "on";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs tabular-nums ${isSkip ? "text-accent-red" : "text-text-dim"}`}>{value}</span>
        <Icon
          icon={isSkip ? "mdi:close-circle" : "mdi:check-circle"}
          width={16}
          className={isSkip ? "text-accent-red" : "text-accent-green"}
        />
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────────

export function IrrigationView() {
  const connection = useHass((s) => s.connection);
  const entities = useHass((s) => s.entities) as HassEntities;
  const { lastRunByZone, allRuns } = useIrrigationRuns(30);
  const [selectedZone, setSelectedZone] = useState<IrrigationZoneConfig | null>(null);

  const frequency = useEntityState(IRRIGATION_FREQUENCY) ?? "every_other_day";
  const skipAny = useEntityState(IRRIGATION_SKIP_ANY) === "on";
  const lastStatus = useEntityState(IRRIGATION_LAST_RUN_STATUS);
  const lastDetails = useEntityState(IRRIGATION_LAST_RUN_DETAILS);
  const heatBoost = useEntityState(IRRIGATION_HEAT_BOOST) === "on";
  const pauseUntil = useEntityState(IRRIGATION_PAUSE_UNTIL);
  const connectivity = useEntityState(IRRIGATION_CONNECTIVITY);

  const rainYesterday = useEntityState(IRRIGATION_RAIN_YESTERDAY);
  const rainToday = useEntityState(IRRIGATION_RAIN_TODAY);
  const precipForecast = useEntityState(IRRIGATION_PRECIP_FORECAST_24H);
  const outdoorTemp = useEntityState(OUTDOOR_TEMP);
  const windSpeed = entities[WEATHER]?.attributes?.wind_speed;
  const temp3dAvg = useEntityState(IRRIGATION_TEMP_3_DAY_AVG);

  // Thresholds for display
  const rainSkipMm = useEntityState(IRRIGATION_RAIN_SKIP_MM);
  const rainHistoryMm = useEntityState(IRRIGATION_RAIN_HISTORY_SKIP_MM);
  const windSkipKmh = useEntityState(IRRIGATION_WIND_SKIP_KMH);
  const freezeTemp = useEntityState(IRRIGATION_FREEZE_TEMP);
  const seasonalTemp = useEntityState(IRRIGATION_SEASONAL_COLD_TEMP);

  const isPaused = pauseUntil && pauseUntil !== "unknown" && pauseUntil !== "unavailable"
    && new Date(pauseUntil) > new Date(new Date().toDateString());
  const isOffline = connectivity === "off";

  // Scheduler-level "running" — drives Run-now disable and the system header.
  const schedulerRunning = lastStatus === "running";
  // Any zone currently watering (including soak). Drives Stop All enable.
  const anyZoneRunning = IRRIGATION_ZONES.some((z) => entities[z.running]?.state === "on");

  const handleStopAll = () => {
    if (!connection) return;
    callService(connection, "input_boolean", "turn_on", {}, { entity_id: IRRIGATION_MANUAL_STOP });
  };

  const handleRunNow = () => {
    if (!connection) return;
    callService(connection, "input_boolean", "turn_on", {}, { entity_id: IRRIGATION_RUN_NOW });
  };

  const handleFrequencyChange = (value: string) => {
    if (!connection) return;
    callService(connection, "input_select", "select_option", { option: value }, { entity_id: IRRIGATION_FREQUENCY });
  };

  const handlePause = (days: number) => {
    if (!connection) return;
    callService(connection, "input_number", "set_value", { value: days }, { entity_id: IRRIGATION_PAUSE_DAYS });
  };

  const handleUnpause = () => {
    if (!connection) return;
    // Set pause_until to yesterday (guaranteed past = unpaused)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    callService(connection, "input_datetime", "set_datetime", { date: yesterday }, { entity_id: IRRIGATION_PAUSE_UNTIL });
  };

  const frequencyOptions = [
    { value: "daily", label: "Every day" },
    { value: "every_other_day", label: "Every other day" },
    { value: "every_2_days", label: "Every 2 days" },
    { value: "every_3_days", label: "Every 3 days" },
    { value: "manual_only", label: "Manual only" },
  ];

  const frequencyLabel = frequencyOptions.find((o) => o.value === frequency)?.label ?? frequency;

  // Group-for-day calculation
  const groupForDate = (date: Date): string => {
    const d = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    if (frequency === "daily" || heatBoost) return "both";
    if (frequency === "every_other_day") return d % 2 === 0 ? "front" : "back";
    if (frequency === "every_2_days") { const c = d % 3; return c === 0 ? "front" : c === 1 ? "back" : "none"; }
    if (frequency === "every_3_days") { const c = d % 4; return c === 0 ? "front" : c === 1 ? "back" : "none"; }
    return "none";
  };

  const today = new Date();
  const todayGroup = groupForDate(today);

  // Next 7 days for calendar
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return { date: d, group: groupForDate(d) };
  });
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      {/* Header with Run Now / Stop All */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Irrigation</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunNow}
            disabled={schedulerRunning || anyZoneRunning || isPaused || isOffline}
            className="rounded-full bg-accent-cool/20 px-3 py-1.5 text-xs font-medium text-accent-cool transition-colors hover:bg-accent-cool/30 disabled:bg-white/5 disabled:text-text-dim"
            title={
              schedulerRunning ? "Scheduler already running"
                : anyZoneRunning ? "A zone is currently watering"
                : isPaused ? "Paused"
                : isOffline ? "Controller offline"
                : "Run today's irrigation now"
            }
          >
            <Icon icon="mdi:play-circle" width={14} className="mr-1 inline-block align-text-bottom" />
            Run now
          </button>
          <button
            onClick={handleStopAll}
            disabled={!anyZoneRunning && !schedulerRunning}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              anyZoneRunning || schedulerRunning
                ? "bg-accent-red/20 text-accent-red hover:bg-accent-red/30"
                : "bg-white/5 text-text-dim"
            }`}
          >
            <Icon icon="mdi:stop-circle" width={14} className="mr-1 inline-block align-text-bottom" />
            Stop All
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="rounded-2xl bg-bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon
              icon={schedulerRunning || anyZoneRunning ? "mdi:sprinkler" : isPaused ? "mdi:pause-circle" : isOffline ? "mdi:cloud-off-outline" : skipAny ? "mdi:water-off" : "mdi:check-circle"}
              width={20}
              className={schedulerRunning || anyZoneRunning ? "text-accent-cool" : isPaused ? "text-accent-warm" : isOffline ? "text-accent-red" : skipAny ? "text-accent-warm" : "text-accent-green"}
            />
            <span className="text-sm font-medium">
              {schedulerRunning
                ? "Running — auto"
                : anyZoneRunning
                  ? "Running — manual"
                  : isPaused
                    ? `Paused until ${pauseUntil}`
                    : isOffline
                      ? "Controller offline"
                      : skipAny
                        ? "Would skip today"
                        : todayGroup === "none"
                          ? "No group scheduled"
                          : `${todayGroup === "both" ? "All zones" : todayGroup === "front" ? "Front group" : "Back group"} scheduled`}
            </span>
          </div>
          {heatBoost && (
            <span className="rounded-full bg-accent-red/20 px-2 py-0.5 text-[10px] font-medium text-accent-red">
              Heat wave
            </span>
          )}
        </div>
        {lastStatus && lastStatus !== "unknown" && lastStatus !== "unavailable" && (
          <p className="mt-1 text-xs text-text-dim">
            Last: {lastDetails && lastDetails !== "unknown" ? lastDetails : lastStatus}
          </p>
        )}
      </div>

      {/* Schedule Controls */}
      <div className="rounded-2xl bg-bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-secondary">Schedule</h2>
          <PopoverSelect
            items={frequencyOptions}
            value={frequency}
            onSelect={handleFrequencyChange}
            trigger={
              <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-text-secondary hover:bg-white/15">
                {frequencyLabel}
                <Icon icon="mdi:chevron-down" width={14} className="ml-1 inline-block align-text-bottom" />
              </button>
            }
          />
        </div>

        {/* Pause controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-dim">Pause:</span>
          {[1, 2, 3, 5, 7].map((d) => (
            <button
              key={d}
              onClick={() => handlePause(d)}
              className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-text-dim hover:bg-white/10"
            >
              {d}d
            </button>
          ))}
          {isPaused && (
            <button
              onClick={handleUnpause}
              className="rounded-full bg-accent-warm/20 px-3 py-1 text-xs font-medium text-accent-warm hover:bg-accent-warm/30"
            >
              Resume now
            </button>
          )}
        </div>

        {/* 7-day calendar */}
        <div className="flex gap-1 pt-2">
          {weekDays.map(({ date, group }, i) => {
            const isToday = i === 0;
            return (
              <div
                key={i}
                className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 ${
                  isToday ? "bg-white/5" : ""
                }`}
              >
                <span className={`text-[10px] ${isToday ? "font-medium text-text-secondary" : "text-text-dim"}`}>
                  {dayLabels[date.getDay()]}
                </span>
                <span className={`text-[10px] ${isToday ? "font-medium text-text-secondary" : "text-text-dim"}`}>
                  {date.getDate()}
                </span>
                {group === "both" ? (
                  <div className="flex gap-0.5">
                    <div className="h-2 w-2 rounded-full bg-accent-blue" title="Front" />
                    <div className="h-2 w-2 rounded-full bg-accent-green" title="Back" />
                  </div>
                ) : group === "front" ? (
                  <div className="h-2 w-2 rounded-full bg-accent-blue" title="Front" />
                ) : group === "back" ? (
                  <div className="h-2 w-2 rounded-full bg-accent-green" title="Back" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/10" title="Off" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone Cards */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Zones</h2>
        <div className="grid grid-cols-2 gap-3">
          {IRRIGATION_ZONES.map((zone) => (
            <ZoneCard
              key={zone.slug}
              zone={zone}
              schedulerRunning={schedulerRunning}
              lastRun={lastRunByZone[zone.slug] ?? null}
              onOpenSettings={() => setSelectedZone(zone)}
            />
          ))}
        </div>
      </div>

      {/* Skip Conditions */}
      <div className="rounded-2xl bg-bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Skip Conditions</h2>
        <SkipRow
          label={`Rain forecast 24h (>${rainSkipMm ?? 5} mm)`}
          entity={IRRIGATION_SKIP_RAIN_FORECAST}
          value={`${precipForecast && precipForecast !== "unknown" ? precipForecast : "—"} mm`}
        />
        <SkipRow
          label={`Rain last 48h (>${rainHistoryMm ?? 8} mm)`}
          entity={IRRIGATION_SKIP_RAIN_ACTUAL}
          value={`${rainYesterday && rainToday ? (Number(rainYesterday) + Number(rainToday)).toFixed(1) : "—"} mm`}
        />
        <SkipRow
          label={`Wind (>${windSkipKmh ?? 25} km/h)`}
          entity={IRRIGATION_SKIP_WIND}
          value={`${windSpeed ?? "—"} km/h`}
        />
        <SkipRow
          label={`Freeze (<${freezeTemp ?? 4}°C now)`}
          entity={IRRIGATION_SKIP_FREEZE}
          value={`${outdoorTemp ?? "—"}°C`}
        />
        <SkipRow
          label={`Seasonal cold (<${seasonalTemp ?? 8}°C 3d avg)`}
          entity={IRRIGATION_SKIP_SEASONAL_COLD}
          value={`${temp3dAvg && temp3dAvg !== "unknown" ? Number(temp3dAvg).toFixed(1) : "—"}°C`}
        />
      </div>

      {/* History */}
      <RunHistory runs={allRuns} />

      {/* Per-zone settings popup (lazy-loaded) */}
      {selectedZone && (
        <Suspense fallback={null}>
          <IrrigationZonePopup
            zone={selectedZone}
            open={!!selectedZone}
            onClose={() => setSelectedZone(null)}
            anyZoneRunning={anyZoneRunning}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Run History ────────────────────────────────────────────────────

function dayLabel(d: Date, today: Date): string {
  const dayDiff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function RunHistory({ runs }: { runs: IrrigationRun[] }) {
  const today = new Date();
  const groups: { label: string; runs: IrrigationRun[] }[] = [];
  let currentLabel: string | null = null;
  for (const run of runs) {
    const label = dayLabel(new Date(run.startedAt), today);
    if (label !== currentLabel) {
      groups.push({ label, runs: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].runs.push(run);
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-2 text-sm font-medium text-text-secondary">Recent runs</h2>
      {runs.length === 0 ? (
        <p className="py-2 text-xs text-text-dim">No runs in the last 30 days.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-dim/70">{g.label}</p>
              <div className="space-y-0.5">
                {g.runs.map((r) => {
                  const time = new Date(r.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  const minutes = Math.max(1, Math.round(r.durationMs / 60000));
                  return (
                    <div
                      key={`${r.slug}-${r.startedAt}`}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs tabular-nums text-text-dim shrink-0">{time}</span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            r.group === "front"
                              ? "bg-accent-blue/20 text-accent-blue"
                              : "bg-accent-green/20 text-accent-green"
                          }`}
                        >
                          {r.group}
                        </span>
                        <span className="text-xs text-text-secondary truncate">{r.name}</span>
                      </div>
                      <span className="text-xs tabular-nums text-text-dim shrink-0">{minutes}m</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
