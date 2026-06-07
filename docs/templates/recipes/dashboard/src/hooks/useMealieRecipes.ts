import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useMealieClient } from "./useMealieClient";
import type { MealiePage, MealieRecipeSummary } from "../lib/mealie-types";
import { MealieError } from "../lib/mealie";

interface State {
  page: MealiePage<MealieRecipeSummary> | null;
  pages: MealieRecipeSummary[];
  isLoading: boolean;
  error: Error | null;
}

export function useMealieRecipes(opts: { search: string; pageSize: number }): State & {
  loadMore: () => void;
  hasMore: boolean;
} {
  const { client } = useMealieClient();
  const [debouncedSearch] = useDebounce(opts.search, 250);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<State>({ page: null, pages: [], isLoading: false, error: null });

  useEffect(() => {
    setPage(1);
    setState((s) => ({ ...s, pages: [] }));
  }, [debouncedSearch]);

  useEffect(() => {
    if (!client) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: null }));
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("perPage", String(opts.pageSize));
    client.request<MealiePage<MealieRecipeSummary>>(
      `/api/recipes?${params}`,
      { signal: ctrl.signal },
    )
      .then((p) => setState((s) => ({
        page: p,
        pages: page === 1 ? p.items : [...s.pages, ...p.items],
        isLoading: false,
        error: null,
      })))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, isLoading: false, error: e instanceof Error ? e : new MealieError(0, null, String(e)) }));
      });
    return () => ctrl.abort();
  }, [client, debouncedSearch, page, opts.pageSize]);

  return {
    ...state,
    hasMore: state.page ? page < state.page.total_pages : false,
    loadMore: () => setPage((p) => p + 1),
  };
}
