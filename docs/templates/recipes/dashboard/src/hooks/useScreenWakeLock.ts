import { useEffect, useRef, useState } from "react";

const recentAttempts = new Map<string, number>();
const DEDUPE_WINDOW_MS = 200;

type Phase = "idle" | "acquiring" | "held" | "releasing";

export function useScreenWakeLock(enabled: boolean): {
  active: boolean;
  supported: boolean;
  error: Error | null;
  phase: Phase;
} {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const cancelledRef = useRef(false);
  const requestIdRef = useRef(0);
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  useEffect(() => {
    if (!enabled || !supported) {
      setPhase("idle"); setActive(false); return;
    }

    cancelledRef.current = false;
    const myReqId = ++requestIdRef.current;
    const key = `wakelock-${myReqId}`;

    async function acquire() {
      // Module-level dedupe survives StrictMode mount-cleanup-mount cycles.
      const last = recentAttempts.get(key);
      if (last && performance.now() - last < DEDUPE_WINDOW_MS) return;
      recentAttempts.set(key, performance.now());

      if (document.visibilityState !== "visible") return;
      setPhase("acquiring");
      try {
        const s = await navigator.wakeLock!.request("screen");
        if (cancelledRef.current || requestIdRef.current !== myReqId) {
          await s.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = s;
        setPhase("held"); setActive(true); setError(null);
        s.addEventListener("release", () => {
          sentinelRef.current = null;
          if (!cancelledRef.current) { setPhase("idle"); setActive(false); }
        });
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setPhase("idle"); setActive(false);
      }
    }

    const onVis = () => {
      if (document.visibilityState === "visible" && !cancelledRef.current && !sentinelRef.current) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelledRef.current = true;
      requestIdRef.current = myReqId + 1; // invalidate any pending acquire
      document.removeEventListener("visibilitychange", onVis);
      const s = sentinelRef.current;
      if (s) {
        setPhase("releasing");
        s.release().finally(() => {
          sentinelRef.current = null;
          setPhase("idle"); setActive(false);
        });
      } else {
        setPhase("idle"); setActive(false);
      }
    };
  }, [enabled, supported]);

  return { active, supported, error, phase };
}
