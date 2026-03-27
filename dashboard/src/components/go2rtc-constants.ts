/** Resolve go2rtc base URL: env variable in dev, same-host fallback in production */
export const GO2RTC_URL =
  (import.meta.env.VITE_GO2RTC_URL as string) ||
  `http://${window.location.hostname}:1984`;

export const RETRY_DELAY = 3000;
export const MAX_RETRIES = 10;
/** Max seconds of buffered video to keep — older frames get evicted */
export const BUFFER_KEEP_SECS = 5;

/** MSE is unavailable on iOS WKWebView — use WebRTC there instead */
export const HAS_MSE =
  typeof MediaSource !== "undefined" ||
  "ManagedMediaSource" in window;

/**
 * Build a list of codecs the browser supports for MSE.
 * go2rtc uses this to pick the best codec for the client.
 * Format: comma-separated MIME strings (e.g. "video/mp4; codecs=\"avc1.42E01E\"").
 */
export function getSupportedCodecs(): string {
  const isTypeSupported =
    "ManagedMediaSource" in window
      ? (window as any).ManagedMediaSource.isTypeSupported
      : MediaSource.isTypeSupported;

  const codecs: string[] = [];
  const videoTypes = [
    'avc1.640029',  // H.264 High
    'avc1.64001F',  // H.264 High 3.1
    'avc1.4D4029',  // H.264 Main
    'avc1.42E01E',  // H.264 Baseline
    'hvc1.1.6.L153.B0', // H.265/HEVC
    'mp4a.40.2',    // AAC-LC
    'mp4a.40.5',    // HE-AAC
    'flac',
    'opus',
  ];

  for (const codec of videoTypes) {
    const mime = codec.startsWith("mp4a") || codec === "flac" || codec === "opus"
      ? `audio/mp4; codecs="${codec}"`
      : `video/mp4; codecs="${codec}"`;
    try {
      if (isTypeSupported(mime)) codecs.push(mime);
    } catch {
      // ignore unsupported
    }
  }

  return codecs.join(", ");
}

/** Try to play video; if blocked by autoplay policy, mute and retry */
export function safePlay(video: HTMLVideoElement) {
  video.play().catch(() => {
    if (!video.muted) {
      video.muted = true;
      video.play().catch(() => {});
    }
  });
}
