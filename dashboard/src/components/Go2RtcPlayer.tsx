import { Icon } from "@iconify/react";
import { useGo2RtcStream } from "../hooks/useGo2RtcStream";

interface Go2RtcPlayerProps {
  stream: string;
  /** Camera entity ID — needed for WebRTC fallback on mobile */
  cameraEntity?: string;
  className?: string;
  onPlaying?: () => void;
}

/**
 * Plays a live go2rtc stream.
 *
 * Desktop (MSE available): fragmented MP4 via direct go2rtc WebSocket (port 1984).
 * iOS / HA app (no MSE): WebRTC via signed `/api/webrtc/ws` path through HA's
 * HTTP server (port 8123). This replicates the AlexxIT WebRTC Camera card approach.
 *
 * Only mount when camera entity state === "streaming".
 */
export function Go2RtcPlayer({ stream, cameraEntity, className, onPlaying }: Go2RtcPlayerProps) {
  const { status, videoRef } = useGo2RtcStream({ stream, cameraEntity, onPlaying });

  return (
    <div className={`relative ${className ?? ""}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        muted
      />
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon
            icon="mdi:loading"
            width={32}
            className="animate-spin text-white/60"
          />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <Icon icon="mdi:video-off" width={32} className="text-text-dim" />
          <span className="text-xs text-text-dim">Stream unavailable</span>
        </div>
      )}
    </div>
  );
}
