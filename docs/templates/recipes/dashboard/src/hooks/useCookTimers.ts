import { useCallback, useEffect, useRef, useState } from "react";
import { useHass, useUser } from "@hakit/core";
import { callService } from "home-assistant-js-websocket";
import { uuidv4 } from "../lib/uuid";
import { notifyServiceForUser } from "../lib/notifyForUser";

export interface CookTimer {
  id: string;
  label: string;
  durationSec: number;
  /** Absolute epoch ms when timer fires. */
  endAt: number;
  /** "running" until firing, then "done" until dismissed. */
  state: "running" | "done";
}

/**
 * Cook-mode timer manager. Holds an array of running/done timers,
 * ticks once per second to derive remaining time, fires a beep when
 * a timer hits zero, and fires the HA `script.recipe_timer` so the
 * user's phone notifies even with the dashboard closed.
 */
export function useCookTimers() {
  const connection = useHass((s) => s.connection);
  const user = useUser();
  const notifyService = notifyServiceForUser(user?.id);
  const [timers, setTimers] = useState<CookTimer[]>([]);
  const [tick, setTick] = useState(0);
  // Track which timers have already fired their beep to avoid double-beeping.
  const beepedRef = useRef<Set<string>>(new Set());

  // 1Hz tick — only re-renders if there's a running timer.
  useEffect(() => {
    if (!timers.some((t) => t.state === "running")) return;
    const handle = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(handle);
  }, [timers]);

  // Promote running timers whose endAt has passed → done + beep.
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const next = timers.map((t) => {
      if (t.state === "running" && t.endAt <= now) {
        if (!beepedRef.current.has(t.id)) {
          beepedRef.current.add(t.id);
          void beep();
        }
        changed = true;
        return { ...t, state: "done" as const };
      }
      return t;
    });
    if (changed) setTimers(next);
  }, [tick, timers]);

  const add = useCallback((label: string, durationSec: number): string | null => {
    if (durationSec <= 0) return null;
    const id = uuidv4();
    const resolvedLabel = label.trim() || `${Math.round(durationSec / 60)} min`;
    setTimers((prev) => [
      ...prev,
      {
        id,
        label: resolvedLabel,
        durationSec,
        endAt: Date.now() + durationSec * 1000,
        state: "running",
      },
    ]);
    // Fire HA script for background mobile notification, targeting the current
    // HA user's phone (not the whole household). Best-effort — local beep is
    // the fallback. We don't await; the script's `delay:` resolves server-side
    // after duration_sec, so the WS call returns immediately.
    if (connection && notifyService) {
      void callService(
        connection,
        "script",
        "recipe_timer",
        {
          label: resolvedLabel,
          duration_sec: durationSec,
          notify_service: notifyService,
        },
      ).catch((err: unknown) => {
        console.warn("[cook timer] HA notify failed (local beep still works):", err);
      });
    }
    return id;
  }, [connection, notifyService]);

  const remove = useCallback((id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
    beepedRef.current.delete(id);
  }, []);

  const restart = useCallback((id: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, endAt: Date.now() + t.durationSec * 1000, state: "running" }
          : t,
      ),
    );
    beepedRef.current.delete(id);
    // Mobile notification: re-fire the HA script for the restarted timer.
    if (connection && notifyService) {
      const t = timers.find((x) => x.id === id);
      if (t) {
        void callService(
          connection,
          "script",
          "recipe_timer",
          {
            label: t.label,
            duration_sec: t.durationSec,
            notify_service: notifyService,
          },
        ).catch(() => { /* swallow — local beep is the fallback */ });
      }
    }
  }, [connection, notifyService, timers]);

  return { timers, add, remove, restart, tick };
}

/** Short pleasant beep. Best-effort — failures swallowed (iOS autoplay quirks). */
async function beep() {
  try {
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two short beeps for emphasis.
    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain).connect(ctx.destination);
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.25);
    }
    // Tidy up after the second beep.
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio unavailable — visual flash is the fallback */
  }
}
