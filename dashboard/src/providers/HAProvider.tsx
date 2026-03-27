import type { ReactNode } from "react";
import { HassConnect } from "@hakit/core";

const HA_TOKEN = import.meta.env.VITE_HA_TOKEN as string | undefined;

/** When embedded in HA as panel_iframe, window.top.hassConnection exists.
 *  Skip the token so @hakit/core inherits the logged-in user's auth,
 *  and use the current origin so the URL matches however HA is accessed. */
const isEmbedded = (() => {
  try { return !!(window.top as any)?.hassConnection; } catch { return false; }
})();

// srcdoc iframes inherit the parent's origin, but window.location.origin
// may still report "null" in some browsers. Fall back to top frame's origin.
const HA_URL = isEmbedded
  ? (() => {
      const origin = window.location.origin;
      if (origin && origin !== "null") return origin;
      try { return window.top?.location.origin ?? origin; } catch { return origin; }
    })()
  : (import.meta.env.VITE_HA_URL as string);

interface HAProviderProps {
  children: ReactNode;
}

export function HAProvider({ children }: HAProviderProps) {
  return (
    <HassConnect
      hassUrl={HA_URL}
      hassToken={isEmbedded ? undefined : HA_TOKEN}
      loading={<LoadingScreen />}
    >
      {children}
    </HassConnect>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-text-secondary text-sm">Connecting to Home Assistant...</p>
      </div>
    </div>
  );
}
