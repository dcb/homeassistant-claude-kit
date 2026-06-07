import type { HassEntities } from "home-assistant-js-websocket";

// --- Types ---

export type RemoteAction =
  | "up" | "down" | "left" | "right" | "ok"
  | "back" | "home" | "menu"
  | "play_pause" | "rewind" | "fast_forward" | "previous" | "next";

export interface ServiceCall {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
  target: { entity_id: string };
}

export interface AppDefinition {
  name: string;
  icon: string;
  color: string;
}

export interface TvAdapter {
  keyCode(action: RemoteAction): string;
  supportedActions: Set<RemoteAction>;
  launchApp(app: AppDefinition, mediaPlayerId: string): ServiceCall;
  getCurrentApp(
    entities: HassEntities,
    remoteEntity: string,
    mediaPlayerId: string,
  ): AppDefinition | undefined;
}

// --- Shared app definitions (platform-independent) ---

export const APP_DEFINITIONS: AppDefinition[] = [
  { name: "Netflix", icon: "simple-icons:netflix", color: "#e50914" },
  { name: "HBO Max", icon: "streamline-logos:hbo-max-logo-solid", color: "#b49aeb" },
  { name: "Disney+", icon: "cbi:disney-plus", color: "#113ccf" },
  { name: "Prime Video", icon: "cbi:prime-video", color: "#00a8e1" },
  { name: "Plex", icon: "simple-icons:plex", color: "#e5a00d" },
  { name: "SkyShowtime", icon: "simple-icons:showtime", color: "#0af" },
  { name: "YouTube", icon: "simple-icons:youtube", color: "#ff0000" },
];

/** Aliases for Cast entity `app_name` → canonical APP_DEFINITIONS name */
const APP_NAME_ALIASES: Record<string, string> = {
  "disney plus": "Disney+",
  "disney+ hotstar": "Disney+",
  "amazon prime video": "Prime Video",
  "hbo max": "HBO Max",
  "max": "HBO Max",
};

/**
 * Map a Cast entity's `app_name` attribute to an AppDefinition.
 * Cast reports human-readable names like "Netflix", "YouTube", etc.
 */
export function getAppIcon(
  appName: string | undefined,
): { icon: string; color: string } | undefined {
  if (!appName) return undefined;
  const lower = appName.toLowerCase();
  const canonical = APP_NAME_ALIASES[lower];
  if (canonical) {
    return APP_DEFINITIONS.find((a) => a.name === canonical);
  }
  return APP_DEFINITIONS.find((a) => a.name.toLowerCase() === lower);
}

// --- Factory ---

export function getAdapter(
  platform: "androidtv" | "samsung",
): Promise<TvAdapter> {
  if (platform === "androidtv") {
    return import("./adapters/androidtv").then((m) => m.androidTvAdapter);
  }
  return import("./adapters/samsung").then((m) => m.samsungAdapter);
}
