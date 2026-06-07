import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useMealieRecipe } from "../../hooks/useMealieRecipe";
import { useMealieClient } from "../../hooks/useMealieClient";
import { RecipeImage } from "./RecipeImage";
import { IngredientList } from "./IngredientList";
import { StepList } from "./StepList";
import { ImportReviewForm } from "./ImportReviewForm";
import { NutritionRow } from "./NutritionRow";
import { scaleFactor } from "../../lib/scaleIngredients";
import type { MealieMealEntryType } from "../../lib/mealie-types";

interface Props {
  slug: string;
  onBack: () => void;
  onCook: (slug: string) => void;
  reviewMode?: boolean;
  onReviewComplete?: () => void;
}

const MEAL_TYPES: MealieMealEntryType[] = ["breakfast", "lunch", "dinner", "snack"];

function isoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecipeDetailSection({ slug, onBack, onCook, reviewMode, onReviewComplete }: Props) {
  const { recipe, isLoading, error, refresh } = useMealieRecipe(slug);
  const { client, baseUrl } = useMealieClient();
  const [planPicker, setPlanPicker] = useState<{ date: string; entryType: MealieMealEntryType } | null>(null);
  const [planMessage, setPlanMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [shopMessage, setShopMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [isAddingToPlan, setIsAddingToPlan] = useState(false);
  const [isAddingToShop, setIsAddingToShop] = useState(false);
  const [localEditMode, setLocalEditMode] = useState(false);
  // Current servings count for ingredient scaling. Resets to the recipe's base
  // whenever the recipe changes (e.g. navigating between recipes).
  const [servings, setServings] = useState<number | null>(null);
  useEffect(() => {
    setServings(recipe?.recipeServings ?? null);
  }, [recipe?.id, recipe?.recipeServings]);
  const showForm = reviewMode || localEditMode;

  if (isLoading) return <div className="p-6 text-white/40">Loading…</div>;
  if (error) return <div className="p-6 text-red-300">Failed to load recipe.</div>;
  if (!recipe) return null;

  if (showForm) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-white/60 underline">← Library</button>
          <h1 className="text-2xl text-white">{reviewMode ? "Review imported recipe" : "Edit recipe"}</h1>
        </div>
        <ImportReviewForm
          recipe={recipe}
          onSaved={() => {
            refresh();
            if (reviewMode) onReviewComplete?.();
            setLocalEditMode(false);
          }}
          onCancel={() => {
            if (reviewMode) onReviewComplete?.();
            setLocalEditMode(false);
          }}
          onDeleted={() => {
            // Navigate back to the library — the recipe no longer exists.
            if (reviewMode) onReviewComplete?.();
            onBack();
          }}
        />
      </div>
    );
  }

  async function addToPlan(date: string, entryType: MealieMealEntryType) {
    if (!client || !recipe) return;
    setIsAddingToPlan(true);
    setPlanMessage(null);
    try {
      await client.addMealplan({ date, entryType, recipeId: recipe.id });
      setPlanMessage({ kind: "ok", text: `Added to ${date} ${entryType}` });
      setPlanPicker(null);
      setTimeout(() => setPlanMessage(null), 3000);
    } catch (e) {
      setPlanMessage({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsAddingToPlan(false);
    }
  }

  async function addToShopping() {
    if (!client || !recipe) return;
    setIsAddingToShop(true);
    setShopMessage(null);
    try {
      const lists = await client.listShoppingLists();
      const listId = lists.items[0]?.id;
      if (!listId) throw new Error("No shopping list configured in Mealie");
      await client.addRecipeToShoppingList(listId, recipe.id);
      setShopMessage({ kind: "ok", text: "Ingredients added to shopping list" });
      setTimeout(() => setShopMessage(null), 3000);
    } catch (e) {
      setShopMessage({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsAddingToShop(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={onBack} className="text-white/60 underline mb-4">
        ← Library
      </button>
      <h1 className="text-3xl text-white">{recipe.name}</h1>
      {recipe.description && <p className="text-white/60 mt-2">{recipe.description}</p>}

      {recipe.image && (
        <RecipeImage
          recipe={recipe}
          baseUrl={baseUrl}
          variant="original"
          width={1200}
          height={750}
          className="w-full max-w-2xl aspect-[16/10] object-cover rounded-2xl mt-4"
        />
      )}

      <div className="flex gap-3 mt-6 flex-wrap">
        <button
          onClick={() => onCook(slug)}
          className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl px-5 py-3 text-lg"
        >
          Cook
        </button>
        <button
          onClick={() => setPlanPicker({ date: isoDateToday(), entryType: "dinner" })}
          disabled={!!planPicker}
          className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-5 py-3"
        >
          Add to plan
        </button>
        <button
          onClick={() => void addToShopping()}
          disabled={isAddingToShop}
          className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-5 py-3"
        >
          {isAddingToShop ? "Adding…" : "Add to shopping list"}
        </button>
        <button
          onClick={() => setLocalEditMode(true)}
          className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-5 py-3"
        >
          Edit
        </button>
      </div>

      {planPicker && (
        <div className="mt-4 bg-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={planPicker.date}
            onChange={(e) => setPlanPicker({ ...planPicker, date: e.target.value })}
            className="bg-white/10 rounded-xl px-3 py-2 text-white outline-none"
          />
          <select
            value={planPicker.entryType}
            onChange={(e) => setPlanPicker({ ...planPicker, entryType: e.target.value as MealieMealEntryType })}
            className="bg-white/10 rounded-xl px-3 py-2 text-white outline-none"
          >
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={() => void addToPlan(planPicker.date, planPicker.entryType)}
            disabled={isAddingToPlan}
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl px-4 py-2"
          >
            {isAddingToPlan ? "Adding…" : "Add"}
          </button>
          <button onClick={() => setPlanPicker(null)} className="text-white/60 underline">
            Cancel
          </button>
        </div>
      )}
      {planMessage && (
        <div className={`mt-3 ${planMessage.kind === "ok" ? "text-green-300" : "text-red-300"}`}>
          {planMessage.text}
        </div>
      )}
      {shopMessage && (
        <div className={`mt-3 ${shopMessage.kind === "ok" ? "text-green-300" : "text-red-300"}`}>
          {shopMessage.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mt-8">
        <div>
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h2 className="text-xl text-white">Ingredients</h2>
            <ServingsStepper
              base={recipe.recipeServings}
              yieldText={recipe.recipeYield}
              value={servings}
              onChange={setServings}
            />
          </div>
          <NutritionRow nutrition={recipe.nutrition} />
          <div className="mt-3" />
          <IngredientList
            items={recipe.recipeIngredient}
            factor={scaleFactor(servings ?? recipe.recipeServings ?? 1, recipe.recipeServings)}
          />
        </div>
        <div>
          <h2 className="text-xl text-white mb-3">Steps</h2>
          <StepList steps={recipe.recipeInstructions} />
        </div>
      </div>
    </div>
  );
}

function ServingsStepper({ base, yieldText, value, onChange }: {
  base: number | null;
  yieldText: string | null;
  value: number | null;
  onChange: (n: number) => void;
}) {
  // Can't meaningfully scale a recipe with no base count. Fall back to the
  // free-text yield (or render nothing if even that's empty).
  if (!base || base <= 0) {
    return yieldText
      ? <span className="text-white/40 text-sm">{yieldText}</span>
      : null;
  }
  const current = value ?? base;
  const dec = () => onChange(Math.max(1, current - 1));
  const inc = () => onChange(Math.min(99, current + 1));
  const reset = () => onChange(base);
  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
      <button
        onClick={dec}
        disabled={current <= 1}
        className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"
        title="Fewer servings"
      >
        <Icon icon="mdi:minus" width={18} />
      </button>
      <button
        onClick={reset}
        className="text-white text-sm font-mono tabular-nums px-2 hover:text-blue-300"
        title={current === base ? "Base recipe servings" : `Reset to ${base}`}
      >
        {current}
      </button>
      <span className="text-white/60 text-sm">servings</span>
      <button
        onClick={inc}
        disabled={current >= 99}
        className="text-white/70 hover:text-white disabled:opacity-30 p-1.5"
        title="More servings"
      >
        <Icon icon="mdi:plus" width={18} />
      </button>
    </div>
  );
}
