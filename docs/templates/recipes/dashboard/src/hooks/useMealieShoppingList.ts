import { useCallback, useEffect, useRef, useState } from "react";
import { useMealieClient } from "./useMealieClient";
import { useEntityState } from "../lib/useEntityState";
import { RECIPE_SHOPPING_POLL_SECONDS } from "../lib/entities";
import type { MealieShoppingItem, MealieShoppingList } from "../lib/mealie-types";

export function useMealieShoppingList(): {
  list: MealieShoppingList | null;
  items: MealieShoppingItem[];
  isLoading: boolean;
  error: Error | null;
  setChecked: (id: string, checked: boolean) => Promise<void>;
} {
  const { client } = useMealieClient();
  const pollSec = Math.max(2, Number.parseInt(useEntityState(RECIPE_SHOPPING_POLL_SECONDS) ?? "5", 10) || 5);
  const [list, setList] = useState<MealieShoppingList | null>(null);
  const [items, setItems] = useState<MealieShoppingItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inflightToggle = useRef<Map<string, AbortController>>(new Map());

  // Load list id once.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    client.listShoppingLists().then((p) => {
      if (!cancelled) setList(p.items[0] ?? null);
    }).catch((e) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))));
    return () => { cancelled = true; };
  }, [client]);

  // Poll items.
  useEffect(() => {
    if (!client || !list) return;
    let cancelled = false;
    let timer: number | undefined;
    async function tick() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        setLoading(items.length === 0);
        const p = await client!.listShoppingItems(list!.id);
        if (cancelled) return;
        // Merge: take server fields except for items currently being toggled (preserve optimistic value).
        setItems((local) => {
          const byId = new Map(local.map((it) => [it.id, it]));
          return p.items.map((srv) => {
            const inflight = inflightToggle.current.has(srv.id);
            const existing = byId.get(srv.id);
            if (inflight && existing) return { ...srv, checked: existing.checked };
            return srv;
          });
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
        if (!cancelled) timer = window.setTimeout(tick, pollSec * 1000);
      }
    }
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    void tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [client, list, pollSec, items.length]);

  const setChecked = useCallback(async (id: string, checked: boolean) => {
    if (!client) return;
    // Optimistic update + read-modify-write PUT (Mealie PUT is full-resource replace).
    setItems((local) => local.map((it) => (it.id === id ? { ...it, checked } : it)));
    const ctrl = new AbortController();
    inflightToggle.current.set(id, ctrl);
    try {
      const current = items.find((it) => it.id === id);
      if (!current) return;
      await client.updateShoppingItem({ ...current, checked });
    } catch (e) {
      // Rollback.
      setItems((local) => local.map((it) => (it.id === id ? { ...it, checked: !checked } : it)));
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      inflightToggle.current.delete(id);
    }
  }, [client, items]);

  return { list, items, isLoading, error, setChecked };
}
