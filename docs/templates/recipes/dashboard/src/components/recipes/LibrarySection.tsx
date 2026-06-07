import { useState } from "react";
import { useEntityState } from "../../lib/useEntityState";
import { RECIPE_LIBRARY_PAGE_SIZE } from "../../lib/entities";
import { useMealieClient } from "../../hooks/useMealieClient";
import { useMealieRecipes } from "../../hooks/useMealieRecipes";
import { RecipeCard } from "./RecipeCard";
import type { MealieRecipeSummary } from "../../lib/mealie-types";

interface Props {
  onOpen: (slug: string) => void;
  onImport: () => void;
  onMealPlan: () => void;
  onShopping: () => void;
}

export function LibrarySection({ onOpen, onImport, onMealPlan, onShopping }: Props) {
  const [search, setSearch] = useState("");
  const pageSizeStr = useEntityState(RECIPE_LIBRARY_PAGE_SIZE) ?? "30";
  const pageSize = Number.parseInt(pageSizeStr, 10) || 30;
  const { baseUrl } = useMealieClient();
  const { pages, hasMore, loadMore, isLoading, error } = useMealieRecipes({ search, pageSize });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl text-white">Recipes</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-[200px] bg-white/5 rounded-xl px-4 py-2 text-white placeholder-white/40 outline-none focus:bg-white/10"
        />
        <button
          type="button"
          onClick={onMealPlan}
          className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2 text-white"
        >
          Meal plan
        </button>
        <button
          type="button"
          onClick={onShopping}
          className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-2 text-white"
        >
          Shopping
        </button>
        <button
          type="button"
          onClick={onImport}
          className="bg-blue-500/80 hover:bg-blue-500 rounded-xl px-4 py-2 text-white"
        >
          + Import
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-200 rounded-xl p-3 mb-4 text-sm">
          Recipe server offline — <code className="font-mono">{error.message}</code>.{" "}
          <button onClick={() => window.location.reload()} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* items-start: don't stretch cards to equal row height. Stretching makes
          short-title cards grow a trailing gap and the image areas read as
          mismatched next to long-title cards. Each card sizes to its content;
          every image stays a fixed 16:10 (see RecipeCard). */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
        {pages.map((r: MealieRecipeSummary) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            baseUrl={baseUrl}
            onOpen={(rec) => onOpen(rec.slug)}
          />
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        {isLoading && <span className="text-white/40">Loading…</span>}
        {!isLoading && hasMore && (
          <button onClick={loadMore} className="text-white/80 hover:text-white underline">
            Load more
          </button>
        )}
        {!isLoading && !hasMore && pages.length > 0 && (
          <span className="text-white/40">No more recipes</span>
        )}
        {!isLoading && pages.length === 0 && !error && (
          <span className="text-white/40">No recipes — try importing one.</span>
        )}
      </div>
    </div>
  );
}
