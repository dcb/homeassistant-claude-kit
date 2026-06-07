import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useMealieRecipe } from "../../hooks/useMealieRecipe";
import { useMealieClient } from "../../hooks/useMealieClient";
import { useScreenWakeLock } from "../../hooks/useScreenWakeLock";
import { useCookTimers } from "../../hooks/useCookTimers";
import { CookModeFrame } from "./CookModeFrame";
import { CookModeTimers } from "./CookModeTimers";
import { NutritionRow } from "./NutritionRow";
import { getStepTimers, parseCookTimers, serializeCookTimers } from "../../lib/recipeTimers";
import { renderScaledIngredient, scaleFactor } from "../../lib/scaleIngredients";
import type { MealieRecipe, MealieRecipeStep, RecipeCookTimer } from "../../lib/mealie-types";

interface Props {
  slug: string;
  onExit: () => void;
}

function loadChecks(recipeId: string): Record<number, boolean> {
  try {
    const raw = localStorage.getItem(`mealie:cook:checks:${recipeId}`);
    return raw ? (JSON.parse(raw).items as Record<number, boolean>) : {};
  } catch { return {}; }
}

function saveChecks(recipeId: string, items: Record<number, boolean>) {
  try {
    localStorage.setItem(`mealie:cook:checks:${recipeId}`, JSON.stringify({ v: 1, items, ts: Date.now() }));
  } catch { /* quota — ignore */ }
}

export function CookModeSection({ slug, onExit }: Props) {
  const { recipe, isLoading, refresh } = useMealieRecipe(slug);
  const { client } = useMealieClient();
  // Snapshot recipe into local state on first ready render — Cook Mode reads from snapshot, not from cache.
  const [snapshot, setSnapshot] = useState<MealieRecipe | null>(null);
  useEffect(() => {
    if (recipe && !snapshot) setSnapshot(recipe);
  }, [recipe, snapshot]);

  const ready = !!snapshot;
  const wake = useScreenWakeLock(ready);
  const cookTimers = useCookTimers();

  const steps: MealieRecipeStep[] = useMemo(
    () => (snapshot?.recipeInstructions ?? []).filter((s) => s.text.trim()),
    [snapshot],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  // Cook-mode has its own servings state — when the cook decides to halve or
  // double the recipe, ingredient quantities scale in place. Resets when the
  // recipe snapshot changes (i.e. switching to a different recipe).
  const [servings, setServings] = useState<number | null>(null);
  useEffect(() => {
    setServings(snapshot?.recipeServings ?? null);
  }, [snapshot?.id, snapshot?.recipeServings]);
  const factor = scaleFactor(
    servings ?? snapshot?.recipeServings ?? 1,
    snapshot?.recipeServings,
  );

  useEffect(() => {
    if (snapshot) setChecks(loadChecks(snapshot.id));
  }, [snapshot]);

  useEffect(() => {
    if (snapshot) saveChecks(snapshot.id, checks);
  }, [checks, snapshot]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack arrow keys when the user is typing in an input (e.g. timer label/minutes).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        setStepIndex((i) => Math.min(i + 1, steps.length - 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setStepIndex((i) => Math.max(i - 1, 0));
        e.preventDefault();
      } else if (e.key === "Escape") {
        if (confirm("Exit Cook Mode?")) onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onExit]);

  if (isLoading && !ready) {
    return (
      <CookModeFrame onExit={onExit} wakeActive={false} wakeSupported={false}>
        <div className="p-8 text-white/40">Loading recipe…</div>
      </CookModeFrame>
    );
  }
  if (!snapshot) return null;

  const step = steps[stepIndex];
  // Read effective timers for this step (durable + pending fallback). When the
  // user pins a timer or edits the list, we always write to the durable map.
  // Keyed by step POSITION — Mealie regenerates step ids on every PATCH, so an
  // id-keyed map would orphan on the next save (see recipeTimers.ts).
  const savedForStep: RecipeCookTimer[] = getStepTimers(snapshot, step, stepIndex);

  async function persistSavedForStep(next: RecipeCookTimer[]) {
    if (!client || !snapshot || !step) return;
    const stepKey = String(stepIndex);
    const prevExtras = snapshot.extras ?? {};
    const prevTimers = parseCookTimers(prevExtras);
    const nextTimersMap: { [stepIndex: string]: RecipeCookTimer[] } = { ...prevTimers };
    if (next.length === 0) delete nextTimersMap[stepKey];
    else nextTimersMap[stepKey] = next;

    // Mealie's extras stores STRINGS (KV table at the storage layer). Encode
    // the whole map into a single JSON string; undefined when empty so we
    // don't keep a "{}" key cluttering the record.
    const serialized = serializeCookTimers(nextTimersMap);
    const nextExtras: typeof prevExtras = { ...prevExtras };
    if (serialized) nextExtras.cookTimers = serialized;
    else delete nextExtras.cookTimers;

    // Optimistic local update so the chip appears immediately.
    setSnapshot({ ...snapshot, extras: nextExtras });
    try {
      await client.updateRecipe(snapshot.slug, { extras: nextExtras });
      // Refresh in background so any merge (e.g. someone else editing) lands.
      refresh();
    } catch (err) {
      console.warn("[cook timers] failed to persist:", err);
      // Roll back optimistic update so the UI doesn't lie.
      setSnapshot(snapshot);
    }
  }

  function saveToStep(timer: RecipeCookTimer) {
    void persistSavedForStep([...savedForStep, timer]);
  }

  function removeSavedAt(index: number) {
    void persistSavedForStep(savedForStep.filter((_, i) => i !== index));
  }

  return (
    <CookModeFrame onExit={onExit} wakeActive={wake.active} wakeSupported={wake.supported}>
      <div className="grid md:grid-cols-2 gap-6 p-6 max-w-5xl mx-auto">
        <div>
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h2 className="text-xl text-white/80">Ingredients</h2>
            <CookServingsStepper
              base={snapshot.recipeServings}
              value={servings}
              onChange={setServings}
            />
          </div>
          <NutritionRow nutrition={snapshot.nutrition} />
          <div className="mt-3" />
          <ul className="space-y-2">
            {snapshot.recipeIngredient.map((it, i) => {
              const label = renderScaledIngredient(it, factor);
              const checked = !!checks[i];
              return (
                <li key={i}>
                  <label className="flex gap-3 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecks((c) => ({ ...c, [i]: e.target.checked }))}
                      className="mt-1 size-5"
                    />
                    <span className={checked ? "text-white/30 line-through" : "text-white"}>{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl text-white/80">Step {stepIndex + 1} of {steps.length}</h2>
          </div>
          <div className="text-2xl text-white leading-relaxed min-h-48">{step?.text}</div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl px-6 py-3 text-white"
            >
              ← Previous
            </button>
            <button
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              disabled={stepIndex === steps.length - 1}
              className="ml-auto bg-blue-500 hover:bg-blue-400 disabled:opacity-30 rounded-xl px-6 py-3 text-white"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
      <CookModeTimers
        active={cookTimers.timers}
        saved={savedForStep}
        canSaveToStep={!!step}
        onAdd={cookTimers.add}
        onRemove={cookTimers.remove}
        onRestart={cookTimers.restart}
        onSaveToStep={saveToStep}
        onRemoveSaved={removeSavedAt}
      />
    </CookModeFrame>
  );
}

function CookServingsStepper({ base, value, onChange }: {
  base: number | null;
  value: number | null;
  onChange: (n: number) => void;
}) {
  if (!base || base <= 0) return null;
  const current = value ?? base;
  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current <= 1}
        className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"
        title="Fewer servings"
      >
        <Icon icon="mdi:minus" width={18} />
      </button>
      <button
        onClick={() => onChange(base)}
        className="text-white text-sm font-mono tabular-nums px-2 hover:text-blue-300"
        title={current === base ? "Base servings" : `Reset to ${base}`}
      >
        {current}
      </button>
      <span className="text-white/60 text-sm">servings</span>
      <button
        onClick={() => onChange(Math.min(99, current + 1))}
        disabled={current >= 99}
        className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"
        title="More servings"
      >
        <Icon icon="mdi:plus" width={18} />
      </button>
    </div>
  );
}
