import type { MealieRecipeSummary } from "../../lib/mealie-types";
import { RecipeImage } from "./RecipeImage";

interface Props {
  recipe: MealieRecipeSummary;
  baseUrl: string;
  onOpen: (recipe: MealieRecipeSummary) => void;
}

export function RecipeCard({ recipe, baseUrl, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(recipe)}
      className="bg-white/5 hover:bg-white/10 rounded-2xl overflow-hidden text-left transition-colors"
    >
      {/* Fixed-aspect container so every card's image area is identical (16:10)
          regardless of the source image's dimensions; the image fills it and is
          center-cropped. The placeholder fills the same box. */}
      <div className="w-full aspect-[16/10] overflow-hidden bg-white/5">
        <RecipeImage
          recipe={recipe}
          baseUrl={baseUrl}
          variant="min"
          width={320}
          height={200}
          className="w-full h-full object-cover object-center"
        />
      </div>
      <div className="p-3">
        <div className="text-white font-medium line-clamp-2">{recipe.name}</div>
        {recipe.description && (
          <div className="text-white/50 text-sm mt-1 line-clamp-2">{recipe.description}</div>
        )}
      </div>
    </button>
  );
}
