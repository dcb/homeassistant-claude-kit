import { useEffect, useState, useRef } from "react";
import { useHass } from "@hakit/core";

export interface HistoryPoint {
  time: number; // epoch ms
  value: number;
}

export interface StateHistoryPoint {
  time: number; // epoch ms
  state: string;
}

interface RawEntry {
  s: string;
  a?: Record<string, unknown>;
  lc?: number;
  lu: number;
}

/**
 * Fetches entity state history via HA websocket `history/stream`.
 * Returns an array of {time, value} points for numeric entities.
 *
 * `startTime` must be a stable ISO string (not recomputed each render).
 */
export function useHistory(entityId: string, startTime: string): HistoryPoint[] {
  const result = useMultiHistory([entityId], startTime);
  return result[entityId] ?? [];
}

/**
 * Fetch history for multiple entities from a given start time.
 * `startTime` is an ISO 8601 string. Must be stable across renders
 * (e.g. memoized or from state) to avoid infinite re-subscriptions.
 */
export function useMultiHistory(
  entityIds: string[],
  startTime: string,
  endTime?: string,
): Record<string, HistoryPoint[]> {
  const connection = useHass((s) => s.connection);
  const [data, setData] = useState<Record<string, HistoryPoint[]>>({});
  const unsubRef = useRef<(() => Promise<void>) | null>(null);
  const idsKey = entityIds.join(",");

  useEffect(() => {
    if (!connection || entityIds.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const unsub = await connection.subscribeMessage<{
          states: Record<string, RawEntry[]>;
        }>(
          (msg) => {
            if (cancelled || !msg.states) return;

            setData((prev) => {
              const next = { ...prev };
              for (const id of entityIds) {
                const entries = msg.states[id];
                if (!entries) continue;

                const newPoints: HistoryPoint[] = [];
                for (const entry of entries) {
                  const n = parseFloat(entry.s);
                  if (!Number.isFinite(n)) continue;
                  const ts = entry.lu * 1000;
                  newPoints.push({ time: ts, value: n });
                }

                const existing = prev[id] ?? [];
                if (existing.length === 0) {
                  next[id] = newPoints;
                  continue;
                }
                // Fast path: new points are all after existing (live updates)
                const lastExisting = existing[existing.length - 1].time;
                const allAfter = newPoints.length > 0 && newPoints[0].time > lastExisting;
                if (allAfter) {
                  next[id] = [...existing, ...newPoints];
                  continue;
                }
                // Slow path: overlapping data, dedupe + sort
                const merged = [...existing, ...newPoints];
                const seen = new Set<number>();
                const unique = merged.filter((p) => {
                  if (seen.has(p.time)) return false;
                  seen.add(p.time);
                  return true;
                });
                unique.sort((a, b) => a.time - b.time);
                next[id] = unique;
              }
              return next;
            });
          },
          {
            type: "history/stream",
            entity_ids: entityIds,
            start_time: startTime,
            ...(endTime ? { end_time: endTime } : {}),
            minimal_response: true,
            significant_changes_only: false,
            no_attributes: true,
          },
        );
        unsubRef.current = unsub;
      } catch {
        // History may not be available
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
      setData({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, idsKey, startTime, endTime]);

  return data;
}

/**
 * Fetch state history for multiple text entities.
 * Unlike useMultiHistory, this preserves non-numeric states.
 */
export function useMultiStateHistory(
  entityIds: string[],
  startTime: string,
  endTime?: string,
): Record<string, StateHistoryPoint[]> {
  const connection = useHass((s) => s.connection);
  const [data, setData] = useState<Record<string, StateHistoryPoint[]>>({});
  const unsubRef = useRef<(() => Promise<void>) | null>(null);
  const idsKey = entityIds.join(",");

  useEffect(() => {
    if (!connection || entityIds.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const unsub = await connection.subscribeMessage<{
          states: Record<string, RawEntry[]>;
        }>(
          (msg) => {
            if (cancelled || !msg.states) return;

            setData((prev) => {
              const next = { ...prev };
              for (const id of entityIds) {
                const entries = msg.states[id];
                if (!entries) continue;

                const newPoints: StateHistoryPoint[] = entries
                  .filter((e) => e.s !== "unavailable" && e.s !== "unknown")
                  .map((e) => ({ time: e.lu * 1000, state: e.s }));

                const existing = prev[id] ?? [];
                if (existing.length === 0) {
                  next[id] = newPoints;
                  continue;
                }
                const lastTime = existing[existing.length - 1].time;
                const fresh = newPoints.filter((p) => p.time > lastTime);
                next[id] = fresh.length > 0 ? [...existing, ...fresh] : existing;
              }
              return next;
            });
          },
          {
            type: "history/stream",
            entity_ids: entityIds,
            start_time: startTime,
            ...(endTime ? { end_time: endTime } : {}),
            minimal_response: true,
            significant_changes_only: true,
            no_attributes: true,
          },
        );
        unsubRef.current = unsub;
      } catch {
        // History may not be available
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
      setData({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, idsKey, startTime, endTime]);

  return data;
}

/**
 * Fetch state history for a text entity (e.g., connector status).
 * Unlike useHistory, this preserves non-numeric states.
 */
export function useStateHistoryPoints(
  entityId: string,
  startTime: string,
  endTime?: string,
): StateHistoryPoint[] {
  const result = useMultiStateHistory([entityId], startTime, endTime);
  return result[entityId] ?? [];
}
