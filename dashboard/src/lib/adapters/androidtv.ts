import type { HassEntities } from "home-assistant-js-websocket";
import type { TvAdapter, RemoteAction, AppDefinition, ServiceCall } from "../tv-adapter";
import { APP_DEFINITIONS } from "../tv-adapter";

const KEY_CODES: Record<RemoteAction, string> = {
  up: "DPAD_UP",
  down: "DPAD_DOWN",
  left: "DPAD_LEFT",
  right: "DPAD_RIGHT",
  ok: "DPAD_CENTER",
  back: "BACK",
  home: "HOME",
  menu: "MENU",
  play_pause: "MEDIA_PLAY_PAUSE",
  rewind: "MEDIA_REWIND",
  fast_forward: "MEDIA_FAST_FORWARD",
  previous: "MEDIA_PREVIOUS",
  next: "MEDIA_NEXT",
};

/** Android TV package names — same order as APP_DEFINITIONS */
const PACKAGES: Record<string, string> = {
  Netflix: "com.netflix.ninja",
  "HBO Max": "com.hbo.hbonow",
  "Disney+": "com.disney.disneyplus",
  "Prime Video": "com.amazon.amazonvideo.livingroom",
  Plex: "com.plexapp.android",
  Showtime: "com.showtime.showtimeanytime",
  YouTube: "com.google.android.youtube.tv",
  Tidal: "com.aspiro.tidal",
};

/** Reverse lookup: package name → app name */
const PACKAGE_TO_APP = Object.fromEntries(
  Object.entries(PACKAGES).map(([name, pkg]) => [pkg, name]),
);

export const androidTvAdapter: TvAdapter = {
  keyCode(action: RemoteAction): string {
    return KEY_CODES[action];
  },

  supportedActions: new Set(Object.keys(KEY_CODES) as RemoteAction[]),

  launchApp(app: AppDefinition, mediaPlayerId: string): ServiceCall {
    const pkg = PACKAGES[app.name];
    return {
      domain: "media_player",
      service: "play_media",
      data: { media_content_type: "app", media_content_id: pkg },
      target: { entity_id: mediaPlayerId },
    };
  },

  getCurrentApp(
    entities: HassEntities,
    remoteEntity: string,
  ): AppDefinition | undefined {
    const activity = entities[remoteEntity]?.attributes?.current_activity as
      | string
      | undefined;
    if (!activity) return undefined;
    const appName = PACKAGE_TO_APP[activity];
    if (!appName) return undefined;
    return APP_DEFINITIONS.find((a) => a.name === appName);
  },
};
