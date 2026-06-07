import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHass } from "@hakit/core";
import { useEntityState } from "../lib/useEntityState";
import { MEALIE_API_TOKEN, MEALIE_URL_EXTERNAL } from "../lib/entities";
import { createMealieClient, type MealieClient } from "../lib/mealie";

// Ingress sessions: ~15-min TTL refreshed on each validate_session. Re-validate every 5 min.
const VALIDATE_INTERVAL_MS = 5 * 60 * 1000;

function setIngressCookie(session: string) {
  // Matches HA frontend's exact pattern (src/data/hassio/ingress.ts).
  const secure = location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `ingress_session=${session};path=/api/hassio_ingress/;SameSite=Strict${secure}`;
}

interface Conn {
  sendMessagePromise: <T = unknown>(msg: object) => Promise<T>;
}

async function mintSession(connection: Conn): Promise<string> {
  const resp = await connection.sendMessagePromise<{ session: string }>({
    type: "supervisor/api",
    endpoint: "/ingress/session",
    method: "post",
  });
  setIngressCookie(resp.session);
  return resp.session;
}

async function validateOrMint(connection: Conn, session: string | null): Promise<string> {
  if (session) {
    try {
      await connection.sendMessagePromise({
        type: "supervisor/api",
        endpoint: "/ingress/validate_session",
        method: "post",
        data: { session },
      });
      return session;
    } catch {
      // fall through to mint
    }
  }
  return mintSession(connection);
}

export function useMealieClient(): {
  client: MealieClient | null;
  ready: boolean;
  baseUrl: string;
  error: Error | null;
} {
  const connection = useHass((s) => s.connection) as Conn | undefined;
  const url = useEntityState(MEALIE_URL_EXTERNAL) ?? "";
  const token = useEntityState(MEALIE_API_TOKEN) ?? "";
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const sessionRef = useRef<string | null>(null);

  // For path-only URLs, do NOT prepend window.location.origin. The dashboard runs in a
  // srcdoc iframe where window.location.origin is "null" — prepending breaks the URL.
  // A leading-/ URL passed to fetch() resolves against the document's base URI (parent's
  // HA origin for srcdoc iframes), which is exactly what we want.
  const baseUrl = url.startsWith("http") || url.startsWith("/") ? url : "";

  const needsIngressSession = baseUrl.includes("/api/hassio_ingress/");

  // Re-mint on demand (called from the client on 401, or by the interval).
  const reMint = useCallback(async () => {
    if (!connection) throw new Error("HA WS connection not ready");
    const next = await mintSession(connection);
    sessionRef.current = next;
    console.debug("[mealie] ingress session minted", next.slice(0, 8) + "…");
    return next;
  }, [connection]);

  // Initial mint + periodic validate.
  useEffect(() => {
    if (!needsIngressSession || !connection) {
      setSessionReady(!needsIngressSession);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    async function loop() {
      try {
        const next = await validateOrMint(connection!, sessionRef.current);
        if (cancelled) return;
        if (next !== sessionRef.current) {
          sessionRef.current = next;
          // mintSession already set the cookie; validateOrMint that took the "mint" path did too.
          // If we took the "validate" path, the session is unchanged and the existing cookie still valid.
          console.debug("[mealie] ingress session updated");
        } else {
          console.debug("[mealie] ingress session validated");
        }
        setSessionReady(true);
        setError(null);
        timer = window.setTimeout(loop, VALIDATE_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        console.error("[mealie] ingress session failed", e);
        setError(e instanceof Error ? e : new Error(String(e)));
        // Don't tear down the session — try again on next interval.
        timer = window.setTimeout(loop, VALIDATE_INTERVAL_MS);
      }
    }

    void loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [needsIngressSession, connection]);

  const client = useMemo(() => {
    if (!baseUrl || !token || !sessionReady) return null;
    return createMealieClient({
      baseUrl,
      token,
      onAuthError: needsIngressSession ? async () => { await reMint(); } : undefined,
    });
  }, [baseUrl, token, sessionReady, needsIngressSession, reMint]);

  return { client, ready: !!client, baseUrl, error };
}
