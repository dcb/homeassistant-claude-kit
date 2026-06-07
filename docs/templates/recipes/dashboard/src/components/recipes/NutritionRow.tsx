import type { MealieNutrition } from "../../lib/mealie-types";

/** Mealie stores nutrition as strings — convert to a number for display, return null on garbage. */
function toNumber(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Per-serving nutrition strip. Renders nothing when no values are present
 * (e.g. URL-imported recipes where Mealie didn't scrape nutrition, or
 * vague-input recipes where the LLM returned null).
 *
 * The "~" prefix is deliberate — every value here is an LLM estimate, and
 * pretending otherwise is dishonest. Calories rounds to nearest 10, macros to
 * nearest 1 g, at extraction time.
 */
export function NutritionRow({ nutrition }: { nutrition: MealieNutrition | null | undefined }) {
  if (!nutrition) return null;
  const kcal = toNumber(nutrition.calories);
  const protein = toNumber(nutrition.proteinContent);
  const carbs = toNumber(nutrition.carbohydrateContent);
  const fat = toNumber(nutrition.fatContent);
  const anything = [kcal, protein, carbs, fat].some((v) => v != null);
  if (!anything) return null;

  const parts: string[] = [];
  if (kcal != null) parts.push(`~${Math.round(kcal)} kcal`);
  if (protein != null) parts.push(`${Math.round(protein)} g protein`);
  if (carbs != null) parts.push(`${Math.round(carbs)} g carbs`);
  if (fat != null) parts.push(`${Math.round(fat)} g fat`);

  return (
    <div className="text-white/50 text-sm">
      {parts.join(" · ")} <span className="text-white/30">per serving</span>
    </div>
  );
}
