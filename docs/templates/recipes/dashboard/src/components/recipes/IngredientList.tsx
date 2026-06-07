import type { MealieRecipeIngredient } from "../../lib/mealie-types";
import { renderScaledIngredient } from "../../lib/scaleIngredients";

interface Props {
  items: MealieRecipeIngredient[];
  /** Scale multiplier applied to numeric quantities. Defaults to 1 (no scaling). */
  factor?: number;
}

export function IngredientList({ items, factor = 1 }: Props) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="text-white">
          {renderScaledIngredient(it, factor)}
        </li>
      ))}
    </ul>
  );
}
