import { useEffect, useState } from "react";
import { useMealieClient } from "./useMealieClient";
import type { MealieRecipe } from "../lib/mealie-types";

export function useMealieRecipe(slug: string | null): {
  recipe: MealieRecipe | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const { client } = useMealieClient();
  const [recipe, setRecipe] = useState<MealieRecipe | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client || !slug) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    client.request<MealieRecipe>(`/api/recipes/${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then((r) => { setRecipe(r); setLoading(false); })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [client, slug, tick]);

  return { recipe, isLoading, error, refresh: () => setTick((t) => t + 1) };
}
