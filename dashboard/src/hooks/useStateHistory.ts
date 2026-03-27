import { useEffect, useState, useRef } from "react";
import { useHass } from "@hakit/core";

export interface StateSpan {
  start: number; // epoch ms
  end: number; // epoch ms (or Date.now() for the last span)
  state: string;
}

interface RawEntry {
  s: string;
  a?: Record<string, unknown>;
  lu: number;
  lc?: number;
}

/**
 * Fetches string state history for an entity via HA websocket `history/stream`.
 * Unlike useHistory (which parses numeric values), this returns raw state strings
 * as time spans — ideal for timeline bars (boiler heat/off, AC modes, etc.).
 *
 * `startTime` must be a stable ISO string to avoid infinite re-subscriptions.
 */
export function useStateHistory(
  entityId: string,
  startTime: string,
  endTime?: string,
): StateSpan[] {
  const result = useMultiStateHistory([entityId], startTime, endTime);
  return result[entityId] ?? [];
}

export function useMultiStateHistory(
  entityIds: string[],
  startTime: string,
  endTime?: string,
): Record<string, StateSpan[]> {
  const connection = useHass((s) => s.connection);
  const [data, setData] = useState<Record<string, StateSpan[]>>({});
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

                const newEntries = entries.map((e) => ({
                  time: (e.lc ?? e.lu) * 1000,
                  state: e.s,
                }));

                // Merge with existing
                const existing = (prev[id] as unknown as StateSpan[]) ?? [];
                // Convert existing spans back to events for re-merge
                const existingEvents: { time: number; state: string }[] = [];
                for (const span of existing) {
                  existingEvents.push({ time: span.start, state: span.state });
                }

                // Fast path: new entries all after existing (live updates)
                const lastExisting = existingEvents.length > 0
                  ? existingEvents[existingEvents.length - 1].time
                  : -1;
                const allAfter = newEntries.length > 0 && newEntries[0].time > lastExisting;
                const unique = allAfter
                  ? [...existingEvents, ...newEntries]
                  : (() => {
                      const allEvents = [...existingEvents, ...newEntries];
                      const seen = new Set<number>();
                      return allEvents.filter((e) => {
                        if (seen.has(e.time)) return false;
                        seen.add(e.time);
                        return true;
                      }).sort((a, b) => a.time - b.time);
                    })();

                // Convert to spans
                const spans: StateSpan[] = [];
                for (let i = 0; i < unique.length; i++) {
                  const end =
                    i + 1 < unique.length
                      ? unique[i + 1].time
                      : Date.now();
                  spans.push({
                    start: unique[i].time,
                    end,
                    state: unique[i].state,
                  });
                }
                next[id] = spans;
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
 * Fetches history for a single entity with attributes, and extracts a specific
 * attribute as the timeline value. Ideal for `hvac_action` on climate entities
 * where the state is just "heat"/"off" but the attribute shows actual activity.
 *
 * Carries forward the last known attribute value across entries where the
 * attribute wasn't included (HA only sends changed attributes).
 */
export function useAttributeTimeline(
  entityId: string,
  attribute: string,
  startTime: string,
  endTime?: string,
): StateSpan[] {
  const connection = useHass((s) => s.connection);
  const [spans, setSpans] = useState<StateSpan[]>([]);
  const unsubRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!connection || !entityId) return;

    let cancelled = false;

    (async () => {
      try {
        const unsub = await connection.subscribeMessage<{
          states: Record<string, RawEntry[]>;
        }>(
          (msg) => {
            if (cancelled || !msg.states) return;

            const entries = msg.states[entityId];
            if (!entries) return;

            setSpans((prev) => {
              // Rebuild transition events from existing spans
              const events: { time: number; state: string }[] = prev.map(
                (s) => ({ time: s.start, state: s.state }),
              );

              // Track the last known value so we only emit on actual transitions
              let lastVal =
                events.length > 0
                  ? events[events.length - 1].state
                  : "";

              for (const entry of entries) {
                const attrVal = entry.a?.[attribute];
                if (attrVal === undefined) continue;
                const val = String(attrVal);
                if (val === lastVal) continue; // no transition
                lastVal = val;
                // Use lu (last_updated), NOT lc (last_changed).
                // lc only updates when the entity state changes, but
                // hvac_action is an attribute — lc can be hours stale.
                events.push({
                  time: entry.lu * 1000,
                  state: val,
                });
              }

              // Dedupe — skip sort when new entries are all appended
              const lastPrevTime = prev.length > 0 ? prev[prev.length - 1].start : -1;
              const newStart = events.length > prev.length ? events[prev.length]?.time ?? Infinity : Infinity;
              let unique: { time: number; state: string }[];
              if (newStart > lastPrevTime) {
                unique = events; // already in order
              } else {
                const seen = new Set<number>();
                unique = events.filter((e) => {
                  if (seen.has(e.time)) return false;
                  seen.add(e.time);
                  return true;
                });
                unique.sort((a, b) => a.time - b.time);
              }

              // Build spans from transitions
              const result: StateSpan[] = [];
              for (let i = 0; i < unique.length; i++) {
                const end =
                  i + 1 < unique.length ? unique[i + 1].time : Date.now();
                result.push({
                  start: unique[i].time,
                  end,
                  state: unique[i].state,
                });
              }
              return result;
            });
          },
          {
            type: "history/stream",
            entity_ids: [entityId],
            start_time: startTime,
            ...(endTime ? { end_time: endTime } : {}),
            minimal_response: true,
            significant_changes_only: false,
            no_attributes: false,
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
      setSpans([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, entityId, attribute, startTime, endTime]);

  return spans;
}
