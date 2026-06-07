import { useMemo, useState } from "react";
import { useMealieClient } from "../../hooks/useMealieClient";
import { useMealieMealPlan } from "../../hooks/useMealieMealPlan";
import { RecipePickerPopup } from "../popups/RecipePickerPopup";
import type { MealieMealEntryType } from "../../lib/mealie-types";

const MEAL_TYPES: MealieMealEntryType[] = ["breakfast", "lunch", "dinner"];

function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Monday as week start (HA convention varies, but Monday is natural for meal planning)
  const day = x.getDay(); // 0=Sun, 1=Mon, ...
  const offset = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + offset);
  return x;
}

export function MealPlanSection({ onBack }: { onBack: () => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const { entries, refresh, isLoading, error } = useMealieMealPlan(weekStart);
  const { client } = useMealieClient();
  const [picker, setPicker] = useState<{ date: string; type: MealieMealEntryType } | null>(null);

  const days = useMemo(() => {
    const out: { date: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      out.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
      });
    }
    return out;
  }, [weekStart]);

  async function addEntry(date: string, type: MealieMealEntryType, recipeId: string) {
    if (!client) return;
    await client.addMealplan({ date, entryType: type, recipeId });
    refresh();
  }

  async function removeEntry(id: number) {
    if (!client) return;
    await client.removeMealplan(id);
    refresh();
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="text-white/60 underline">
          ← Recipes
        </button>
        <h1 className="text-2xl text-white">Meal Plan</h1>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              setWeekStart((w) => {
                const d = new Date(w);
                d.setDate(d.getDate() - 7);
                return d;
              })
            }
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white"
          >
            ←
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek())}
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white"
          >
            Today
          </button>
          <button
            onClick={() =>
              setWeekStart((w) => {
                const d = new Date(w);
                d.setDate(d.getDate() + 7);
                return d;
              })
            }
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white"
          >
            →
          </button>
        </div>
      </div>

      {error && <div className="text-red-300 mb-3">Failed to load meal plan.</div>}
      {isLoading && <div className="text-white/40 mb-3">Loading…</div>}

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.date} className="bg-white/5 rounded-2xl p-3">
            <div className="text-white/60 text-sm mb-2">{d.label}</div>
            {MEAL_TYPES.map((t) => {
              const e = entries.find((x) => x.date === d.date && x.entryType === t);
              return (
                <div key={t} className="mb-2">
                  <div className="text-white/40 text-xs uppercase">{t}</div>
                  {e ? (
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="text-white text-sm bg-white/10 hover:bg-red-500/30 rounded px-2 py-1 w-full text-left"
                      title="Click to remove"
                    >
                      {e.recipe?.name ?? e.title ?? "—"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setPicker({ date: d.date, type: t })}
                      className="text-white/40 hover:text-white text-sm w-full text-left"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <RecipePickerPopup
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={(_slug, id) => {
          if (picker) {
            void addEntry(picker.date, picker.type, id);
            setPicker(null);
          }
        }}
      />
    </div>
  );
}
