import { useState } from "react";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { BottomSheet } from "./BottomSheet";
import { useMealieRecipes } from "../../hooks/useMealieRecipes";
import { useMealieClient } from "../../hooks/useMealieClient";
import { RecipeCard } from "../recipes/RecipeCard";
import { useEntityState } from "../../lib/useEntityState";
import { RECIPE_LIBRARY_PAGE_SIZE } from "../../lib/entities";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (slug: string, id: string, name: string) => void;
}

export function RecipePickerPopup({ open, onClose, onPick }: Props) {
  const [search, setSearch] = useState("");
  const pageSizeStr = useEntityState(RECIPE_LIBRARY_PAGE_SIZE) ?? "30";
  const pageSize = Number.parseInt(pageSizeStr, 10) || 30;
  const { baseUrl } = useMealieClient();
  const { pages, isLoading, error } = useMealieRecipes({ search, pageSize });

  return (
    <BottomSheet open={open} onClose={onClose} className="max-w-3xl">
      <DialogTitle className="sr-only">Pick a recipe</DialogTitle>
      <DialogDescription className="sr-only">Search and pick a recipe to add to the meal plan.</DialogDescription>
      <div className="p-4">
        <h2 className="text-xl text-white mb-3">Pick a recipe</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="w-full bg-white/5 rounded-xl px-4 py-2 text-white placeholder-white/40 mb-4 outline-none focus:bg-white/10"
        />
        {error && <div className="text-red-300">Failed to load.</div>}
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {pages.map((r) => (
            <RecipeCard key={r.id} recipe={r} baseUrl={baseUrl} onOpen={(rec) => onPick(rec.slug, rec.id, rec.name)} />
          ))}
        </div>
        {isLoading && <div className="text-center text-white/40 mt-3">Loading…</div>}
      </div>
    </BottomSheet>
  );
}
