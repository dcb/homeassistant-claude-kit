import { useCallback, useEffect, useState } from "react";
import { useMealieClient } from "./useMealieClient";
import type { MealieMealplanEntry } from "../lib/mealie-types";

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

export function useMealieMealPlan(weekStart: Date): {
  entries: MealieMealplanEntry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const { client } = useMealieClient();
  const [entries, setEntries] = useState<MealieMealplanEntry[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client) return;
    const ctrl = new AbortController();
    const start = isoDate(weekStart);
    const endD = new Date(weekStart); endD.setDate(endD.getDate() + 6);
    const end = isoDate(endD);
    setLoading(true);
    client.request<{ items: MealieMealplanEntry[] }>(
      `/api/households/mealplans?start_date=${start}&end_date=${end}&perPage=200`,
      { signal: ctrl.signal },
    )
      .then((p) => { setEntries(p.items); setLoading(false); setError(null); })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [client, weekStart.getTime(), tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { entries, isLoading, error, refresh };
}
