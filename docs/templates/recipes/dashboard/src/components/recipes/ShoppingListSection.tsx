import { useMealieShoppingList } from "../../hooks/useMealieShoppingList";

export function ShoppingListSection({ onBack }: { onBack: () => void }) {
  const { items, isLoading, error, setChecked } = useMealieShoppingList();
  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.position - b.position);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-white/60 underline">
          ← Recipes
        </button>
        <h1 className="text-2xl text-white">Shopping List</h1>
      </div>
      {error && <div className="text-red-300 mb-3">Failed to load.</div>}
      {isLoading && items.length === 0 && <div className="text-white/40">Loading…</div>}
      {!isLoading && items.length === 0 && !error && (
        <div className="text-white/40">
          Shopping list is empty. Add a recipe's ingredients from the recipe detail page.
        </div>
      )}
      <ul className="space-y-2">
        {sorted.map((it) => {
          const label = it.display ?? it.note ?? "(unparsable)";
          return (
            <li key={it.id}>
              <label className="flex gap-3 items-start bg-white/5 rounded-xl p-3 cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={it.checked}
                  onChange={(e) => void setChecked(it.id, e.target.checked)}
                  className="mt-1 size-5"
                />
                <span className={it.checked ? "text-white/30 line-through" : "text-white"}>{label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
