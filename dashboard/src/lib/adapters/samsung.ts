import type { HassEntities } from "home-assistant-js-websocket";
import type { TvAdapter, RemoteAction, AppDefinition, ServiceCall } from "../tv-adapter";
import { APP_DEFINITIONS } from "../tv-adapter";

const KEY_CODES: Partial<Record<RemoteAction, string>> = {
  up: "KEY_UP",
  down: "KEY_DOWN",
  left: "KEY_LEFT",
  right: "KEY_RIGHT",
  ok: "KEY_ENTER",
  back: "KEY_RETURN",
  home: "KEY_HOME",
  menu: "KEY_MENU",
  play_pause: "KEY_PLAYPAUSE",
  rewind: "KEY_RW",
  fast_forward: "KEY_FF",
  // previous/next omitted — no reliable streaming equivalent
};

/** Tizen app IDs — used by samsungtv_smart for getCurrentApp detection via `app_id` attribute */
const TIZEN_APP_IDS: Record<string, string> = {
  "org.tizen.netflix-app": "Netflix",
  "5b8c3eb16b.BeamCTVDev": "HBO Max",
  "MCmYXNxgcu.DisneyPlus": "Disney+",
  "org.tizen.primevideo": "Prime Video",
  "kIciSQlYEM.plex": "Plex",
  "skysh0WTIM.SkyShowtime": "SkyShowtime",
  "9Ur5IzDKqV.TizenYouTube": "YouTube",
};

export const samsungAdapter: TvAdapter = {
  keyCode(action: RemoteAction): string {
    const code = KEY_CODES[action];
    if (!code) throw new Error(`Samsung does not support action: ${action}`);
    return code;
  },

  supportedActions: new Set(Object.keys(KEY_CODES) as RemoteAction[]),

  launchApp(app: AppDefinition, mediaPlayerId: string): ServiceCall {
    return {
      domain: "media_player",
      service: "select_source",
      data: { source: app.name },
      target: { entity_id: mediaPlayerId },
    };
  },

  getCurrentApp(
    entities: HassEntities,
    _remoteEntity: string,
    mediaPlayerId: string,
  ): AppDefinition | undefined {
    const appId = entities[mediaPlayerId]?.attributes?.app_id as
      | string
      | undefined;
    if (!appId) return undefined;
    const appName = TIZEN_APP_IDS[appId];
    if (!appName) return undefined;
    return APP_DEFINITIONS.find((a) => a.name === appName);
  },
};
