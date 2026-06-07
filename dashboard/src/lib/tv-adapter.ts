/**
 * Platform adapters for remote control (currently: Apple TV).
 * Each platform exposes a standardised TvAdapter so RemotePopup stays generic.
 */

export type RemoteAction =
  | "up" | "down" | "left" | "right" | "ok"
  | "back" | "home" | "menu"
  | "play_pause" | "skip_forward" | "skip_backward"
  | "previous" | "next" | "rewind" | "fast_forward"
  | "volume_up" | "volume_down" | "mute";

export interface AppDefinition {
  name: string;
  /** Iconify icon name */
  icon: string;
  color: string;
  /** Platform-specific app identifier */
  appId: string;
}

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  target: Record<string, unknown>;
}

export interface TvAdapter {
  platform: string;
  /** Set of RemoteAction values this platform supports (used to show/hide buttons). */
  supportedActions: Set<RemoteAction>;
  /** Maps a RemoteAction to the HA remote.send_command `command` string. */
  keyCode: (action: RemoteAction) => string | null;
  /** Maps a raw media_player app_id to an AppDefinition (or undefined if unknown). */
  resolveApp: (appId: string) => AppDefinition | undefined;
  /** Returns the currently active AppDefinition (or undefined if unknown). */
  getCurrentApp: (entities: Record<string, { attributes?: Record<string, unknown> }>, remoteEntity: string, mediaPlayerId: string) => AppDefinition | undefined;
  /** Returns the service call needed to launch an app. */
  launchApp: (app: AppDefinition, mediaPlayerId: string) => ServiceCall;
}

// ── App catalog ────────────────────────────────────────────────────────────

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    name: "Netflix",
    icon: "simple-icons:netflix",
    color: "#E50914",
    appId: "com.netflix.Netflix",
  },
  {
    name: "Disney+",
    icon: "simple-icons:disneyplus",
    color: "#113CCF",
    appId: "com.disney.disneyplus",
  },
  {
    name: "YouTube",
    icon: "simple-icons:youtube",
    color: "#FF0000",
    appId: "com.google.ios.youtube",
  },
  {
    name: "Prime Video",
    icon: "simple-icons:primevideo",
    color: "#00A8E0",
    appId: "com.amazon.aiv.AIVApp",
  },
  {
    name: "Apple TV+",
    icon: "simple-icons:appletv",
    color: "#A2AAAD",
    appId: "com.apple.TVWatchList",
  },
  {
    name: "Plex",
    icon: "simple-icons:plex",
    color: "#E5A00D",
    appId: "com.plexapp.plex",
  },
];

// Index for fast lookups
const APP_BY_ID = new Map(APP_DEFINITIONS.map((a) => [a.appId, a]));
const APP_BY_NAME = new Map(APP_DEFINITIONS.map((a) => [a.name.toLowerCase(), a]));

export function getAppIcon(appId: string): string {
  return APP_BY_ID.get(appId)?.icon ?? "mdi:television-play";
}

// ── Apple TV adapter ───────────────────────────────────────────────────────

const APPLE_TV_COMMANDS: Record<RemoteAction, string | null> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  ok: "select",
  back: "menu",
  home: "home",
  menu: "top_menu",
  play_pause: "play_pause",
  skip_forward: "skip_forward",
  skip_backward: "skip_backward",
  previous: null,
  next: null,
  rewind: null,
  fast_forward: null,
  volume_up: "volume_up",
  volume_down: "volume_down",
  mute: "volume_mute",
};

const APPLE_TV_SUPPORTED = new Set<RemoteAction>(
  (Object.entries(APPLE_TV_COMMANDS) as [RemoteAction, string | null][])
    .filter(([, v]) => v !== null)
    .map(([k]) => k),
);

const appleTvAdapter: TvAdapter = {
  platform: "apple_tv",
  supportedActions: APPLE_TV_SUPPORTED,
  keyCode: (action) => APPLE_TV_COMMANDS[action] ?? null,
  resolveApp: (appId) => {
    const byId = APP_BY_ID.get(appId);
    if (byId) return byId;
    return APP_BY_NAME.get(appId.toLowerCase());
  },
  getCurrentApp: (entities, _remoteEntity, mediaPlayerId) => {
    const attrs = entities[mediaPlayerId]?.attributes;
    const appId = (attrs?.app_id as string | undefined) ?? (attrs?.app_name as string | undefined);
    return appId ? appleTvAdapter.resolveApp(appId) : undefined;
  },
  launchApp: (app, mediaPlayerId) => ({
    domain: "media_player",
    service: "select_source",
    data: { source: app.appId },
    target: { entity_id: mediaPlayerId },
  }),
};

// ── Generic fallback ───────────────────────────────────────────────────────

const GENERIC_COMMANDS: Record<RemoteAction, string> = {
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  ok: "OK",
  back: "BACK",
  home: "HOME",
  menu: "MENU",
  play_pause: "PLAY",
  skip_forward: "SKIP_FORWARD",
  skip_backward: "SKIP_BACKWARD",
  previous: "PREVIOUS",
  next: "NEXT",
  rewind: "REWIND",
  fast_forward: "FAST_FORWARD",
  volume_up: "VOLUME_UP",
  volume_down: "VOLUME_DOWN",
  mute: "MUTE",
};

const GENERIC_SUPPORTED = new Set<RemoteAction>(Object.keys(GENERIC_COMMANDS) as RemoteAction[]);

const genericAdapter: TvAdapter = {
  platform: "generic",
  supportedActions: GENERIC_SUPPORTED,
  keyCode: (action) => GENERIC_COMMANDS[action] ?? null,
  resolveApp: (appId) => APP_BY_ID.get(appId),
  getCurrentApp: (entities, _remoteEntity, mediaPlayerId) => {
    const appId = entities[mediaPlayerId]?.attributes?.app_id as string | undefined;
    return appId ? APP_BY_ID.get(appId) : undefined;
  },
  launchApp: (app, mediaPlayerId) => ({
    domain: "media_player",
    service: "select_source",
    data: { source: app.appId },
    target: { entity_id: mediaPlayerId },
  }),
};

// ── Public factory ─────────────────────────────────────────────────────────

const ADAPTERS: Record<string, TvAdapter> = {
  apple_tv: appleTvAdapter,
  generic: genericAdapter,
};

/** Returns the adapter for the given platform (async for future dynamic imports). */
export async function getAdapter(platform?: string): Promise<TvAdapter> {
  if (!platform) return genericAdapter;
  return ADAPTERS[platform] ?? genericAdapter;
}
