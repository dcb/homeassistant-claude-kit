import { useState } from "react";
import { Icon } from "@iconify/react";
import type { CookTimer } from "../../hooks/useCookTimers";
import type { RecipeCookTimer } from "../../lib/mealie-types";
import { formatHMS } from "../../lib/formatDuration";

interface Props {
  /** Timers currently running or finished. */
  active: CookTimer[];
  /** Persistable timers saved on the currently-shown step (from extras.cookTimers[stepIndex]). */
  saved: RecipeCookTimer[];
  /** Whether a step is currently selected (false → hide save affordances). */
  canSaveToStep: boolean;
  onAdd: (label: string, durationSec: number) => void;
  onRemove: (id: string) => void;
  onRestart: (id: string) => void;
  /** Persist a saved timer to current step (called when the user pins an active timer). */
  onSaveToStep: (timer: RecipeCookTimer) => void;
  onRemoveSaved: (index: number) => void;
}

export function CookModeTimers({
  active,
  saved,
  canSaveToStep,
  onAdd,
  onRemove,
  onRestart,
  onSaveToStep,
  onRemoveSaved,
}: Props) {
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");

  function submit() {
    const m = parseFloat(minutes);
    if (!Number.isFinite(m) || m <= 0) return;
    onAdd(label, Math.round(m * 60));
    setLabel("");
    setMinutes("");
  }

  function isSavedMatch(t: CookTimer): boolean {
    return saved.some((s) => s.label === t.label && s.durationSec === t.durationSec);
  }

  return (
    <div className="border-t border-white/10 p-4 flex flex-col gap-3">
      {saved.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-white/60 text-sm shrink-0">For this step</span>
          {saved.map((s, i) => (
            <SavedChip
              key={`${s.label}-${s.durationSec}-${i}`}
              timer={s}
              onStart={() => onAdd(s.label, s.durationSec)}
              onRemove={() => onRemoveSaved(i)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-white/60 text-sm shrink-0">Timers</span>
        {active.map((t) => (
          <ActiveChip
            key={t.id}
            timer={t}
            canPin={canSaveToStep && !isSavedMatch(t)}
            onRemove={() => onRemove(t.id)}
            onRestart={() => onRestart(t.id)}
            onPin={() => onSaveToStep({ label: t.label, durationSec: t.durationSec })}
          />
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="bg-white/5 rounded-lg px-2 py-1.5 text-white placeholder-white/30 text-sm w-28 outline-none focus:bg-white/10"
          />
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="min"
            min={0}
            step={0.5}
            className="bg-white/5 rounded-lg px-2 py-1.5 text-white placeholder-white/30 text-sm w-20 outline-none focus:bg-white/10"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <button
            onClick={submit}
            disabled={!minutes.trim() || !(parseFloat(minutes) > 0)}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-30 text-white rounded-lg px-3 py-1.5 text-sm"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function SavedChip({ timer, onStart, onRemove }: {
  timer: RecipeCookTimer;
  onStart: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-white/10 text-white pl-3 pr-1 py-1 flex items-center gap-2">
      <button onClick={onStart} className="flex items-center gap-2" title="Start this timer">
        <Icon icon="mdi:play-circle-outline" width={18} />
        <span className="text-sm">{timer.label}</span>
        <span className="font-mono text-sm tabular-nums text-white/70">
          {formatHMS(timer.durationSec)}
        </span>
      </button>
      <button
        onClick={onRemove}
        className="text-white/40 hover:text-white p-1"
        title="Remove saved timer"
      >
        <Icon icon="mdi:close" width={14} />
      </button>
    </div>
  );
}

function ActiveChip({ timer, canPin, onRemove, onRestart, onPin }: {
  timer: CookTimer;
  canPin: boolean;
  onRemove: () => void;
  onRestart: () => void;
  onPin: () => void;
}) {
  const remaining = timer.state === "running"
    ? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000))
    : 0;
  const done = timer.state === "done";
  return (
    <div
      className={`rounded-xl px-3 py-2 flex items-center gap-2 ${
        done ? "bg-orange-500/30 text-orange-100 animate-pulse" : "bg-white/10 text-white"
      }`}
    >
      <Icon icon={done ? "mdi:bell-ring" : "mdi:timer-outline"} width={18} />
      <span className="text-sm">{timer.label}</span>
      <span className="font-mono text-sm tabular-nums">
        {done ? "done" : formatHMS(remaining)}
      </span>
      {canPin && !done ? (
        <button
          onClick={onPin}
          className="text-white/50 hover:text-white"
          title="Save this timer to the current step"
        >
          <Icon icon="mdi:pin-outline" width={16} />
        </button>
      ) : null}
      {done ? (
        <button onClick={onRestart} className="text-orange-100 hover:text-white" title="Restart">
          <Icon icon="mdi:reload" width={16} />
        </button>
      ) : null}
      <button onClick={onRemove} className="text-white/50 hover:text-white" title="Remove">
        <Icon icon="mdi:close" width={16} />
      </button>
    </div>
  );
}
