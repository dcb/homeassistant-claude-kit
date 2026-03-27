import { useEffect, useRef, useState } from "react";
import { useHass } from "@hakit/core";
import type { Connection } from "home-assistant-js-websocket";
import {
  GO2RTC_URL,
  RETRY_DELAY,
  MAX_RETRIES,
  BUFFER_KEEP_SECS,
  HAS_MSE,
  getSupportedCodecs,
  safePlay,
} from "../components/go2rtc-constants";

interface UseGo2RtcStreamOptions {
  stream: string;
  /** Camera entity ID — needed for WebRTC fallback on mobile */
  cameraEntity?: string;
  onPlaying?: () => void;
}

/**
 * Manages the go2rtc stream connection lifecycle.
 *
 * Desktop (MSE available): fragmented MP4 via direct go2rtc WebSocket (port 1984).
 * iOS / HA app (no MSE): WebRTC via signed `/api/webrtc/ws` path through HA's
 * HTTP server (port 8123). This replicates the AlexxIT WebRTC Camera card approach.
 */
export function useGo2RtcStream({ stream, cameraEntity, onPlaying }: UseGo2RtcStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const connection = useHass((s) => s.connection) as Connection | null;
  const [status, setStatus] = useState<"connecting" | "playing" | "error">(
    "connecting",
  );

  useEffect(() => {
    if (!videoRef.current) {
      setStatus("error");
      return;
    }
    const video = videoRef.current;

    let disposed = false;
    let retryCount = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    let ms: MediaSource | null = null;
    let pc: RTCPeerConnection | null = null;
    let videoErrorHandler: (() => void) | null = null;

    async function connect() {
      if (disposed) return;
      setStatus("connecting");

      if (HAS_MSE) {
        // Desktop: direct go2rtc WebSocket on port 1984
        const wsUrl = `${GO2RTC_URL.replace(/^http/, "ws")}/api/ws?src=${stream}`;
        ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        connectMse(ws, video);
      } else {
        // Mobile: sign path through HA, connect via port 8123
        if (!connection || !cameraEntity) {
          setStatus("error");
          return;
        }
        try {
          const data = await connection.sendMessagePromise<{ path: string }>({
            type: "auth/sign_path",
            path: "/api/webrtc/ws",
          });
          if (disposed) return;

          // Build WebSocket URL through HA's HTTP server
          const haUrl = window.location.origin;
          const wsUrl = `${haUrl.replace(/^http/, "ws")}${data.path}&entity=${cameraEntity}`;
          ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";
          connectWebRtc(ws, video);
        } catch (e) {
          console.error("go2rtc: failed to sign WebSocket path", e);
          scheduleRetry();
        }
      }
    }

    // ---- MSE path (desktop) ----
    function connectMse(socket: WebSocket, vid: HTMLVideoElement) {
      let sb: SourceBuffer | null = null;
      // Pre-allocated 2MB buffer for coalescing small segments
      let buf = new Uint8Array(2 * 1024 * 1024);
      let bufLen = 0;
      let sourceOpen = false;
      let pendingCodec: string | null = null;
      let handled = false;

      const useManagedMs = "ManagedMediaSource" in window;
      try {
        ms = useManagedMs
          ? new (window as any).ManagedMediaSource()
          : new MediaSource();
        if (useManagedMs) {
          vid.disableRemotePlayback = true;
          vid.srcObject = ms;
        } else {
          vid.src = URL.createObjectURL(ms!);
        }
      } catch (e) {
        console.error("go2rtc: MediaSource creation failed", e);
        setStatus("error");
        return;
      }

      // Video error → close WebSocket → triggers reconnect
      if (videoErrorHandler) vid.removeEventListener("error", videoErrorHandler);
      videoErrorHandler = () => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      };
      vid.addEventListener("error", videoErrorHandler);

      const flushBuf = () => {
        if (!sb || sb.updating || bufLen === 0) return;
        try {
          sb.appendBuffer(buf.slice(0, bufLen));
          bufLen = 0;
        } catch {
          // Buffer full or closed — will retry on next updateend
        }
      };

      const initSourceBuffer = (codec: string) => {
        if (disposed || !ms || ms.readyState !== "open") return;
        try {
          sb = ms.addSourceBuffer(codec);
          sb.mode = "segments";
          sb.addEventListener("updateend", () => {
            if (!sb || sb.updating) return;

            // Trim buffer to keep only BUFFER_KEEP_SECS of video
            if (sb.buffered.length > 0) {
              const start = sb.buffered.start(0);
              const end = sb.buffered.end(sb.buffered.length - 1);

              if (end - start > BUFFER_KEEP_SECS) {
                try {
                  sb.remove(start, end - BUFFER_KEEP_SECS);
                } catch { /* ignore */ }
                return; // wait for the remove to complete before flushing
              }

              // Sync playback to live edge — adjust playbackRate based on gap
              if (vid.paused) {
                safePlay(vid);
              } else {
                const gap = end - vid.currentTime;
                if (gap > 0.5) {
                  // Too far behind — jump to live
                  vid.currentTime = end - 0.2;
                } else if (gap > 0.1) {
                  vid.playbackRate = 1.05;
                } else {
                  vid.playbackRate = 1.0;
                }
              }
            }

            flushBuf();
          });

          // Set live seekable range for ManagedMediaSource
          if (useManagedMs && ms && "setLiveSeekableRange" in ms) {
            try { (ms as any).setLiveSeekableRange(0, 0); } catch { /* ignore */ }
          }

          flushBuf();
        } catch (e) {
          console.error("go2rtc: SourceBuffer failed", e);
          if (!handled) { handled = true; scheduleRetry(); }
        }
      };

      ms!.addEventListener("sourceopen", () => {
        sourceOpen = true;
        if (pendingCodec) initSourceBuffer(pendingCodec);
      });

      socket.onopen = () => {
        if (disposed) return;
        // Send supported codecs so go2rtc picks the best match
        const codecs = getSupportedCodecs();
        socket.send(JSON.stringify({ type: "mse", value: codecs }));
      };

      socket.onmessage = (ev) => {
        if (disposed) return;
        if (typeof ev.data === "string") {
          const msg = JSON.parse(ev.data);
          if (msg.type === "mse") {
            if (sourceOpen) initSourceBuffer(msg.value);
            else pendingCodec = msg.value;
          } else if (msg.type === "error") {
            console.log("go2rtc:", msg.value);
            if (!handled) { handled = true; scheduleRetry(); }
          }
        } else {
          // Coalesce binary segments into pre-allocated buffer
          const data = new Uint8Array(ev.data as ArrayBuffer);
          if (bufLen + data.length > buf.length) {
            // Buffer full — flush what we have first, then start fresh
            flushBuf();
            if (data.length > buf.length) {
              // Single segment larger than our buffer — append directly
              if (sb && !sb.updating) {
                try { sb.appendBuffer(data); } catch { /* ignore */ }
              }
              return;
            }
          }
          buf.set(data, bufLen);
          bufLen += data.length;

          // Flush immediately if source buffer isn't busy
          if (sb && !sb.updating) {
            flushBuf();
          }

          setStatus((prev) => {
            if (prev !== "playing") onPlaying?.();
            return "playing";
          });
        }
      };

      socket.onerror = () => {
        if (!disposed && !handled) { handled = true; scheduleRetry(); }
      };
      socket.onclose = () => {
        if (!disposed && !handled) { handled = true; scheduleRetry(); }
      };

      vid.addEventListener("loadeddata", () => safePlay(vid), { once: true });
    }

    // ---- WebRTC path (iOS / HA companion app) ----
    // Replicates AlexxIT VideoRTC: trickle ICE, webrtc/offer + webrtc/answer
    // message types, signed WebSocket through HA's HTTP server.
    function connectWebRtc(socket: WebSocket, vid: HTMLVideoElement) {
      let handled = false;

      socket.onopen = async () => {
        if (disposed) return;
        try {
          pc = new RTCPeerConnection({
            bundlePolicy: "max-bundle",
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          pc.addTransceiver("video", { direction: "recvonly" });
          pc.addTransceiver("audio", { direction: "recvonly" });

          // Trickle ICE — send candidates as they arrive
          pc.onicecandidate = (ev) => {
            if (socket.readyState !== WebSocket.OPEN) return;
            const candidate = ev.candidate ? ev.candidate.toJSON().candidate : "";
            socket.send(JSON.stringify({ type: "webrtc/candidate", value: candidate }));
          };

          pc.ontrack = (ev) => {
            if (disposed) return;
            // Use the stream from the event directly
            if (ev.streams.length > 0) {
              vid.srcObject = ev.streams[0];
              safePlay(vid);
            }
          };

          pc.onconnectionstatechange = () => {
            if (disposed) return;
            if (pc?.connectionState === "connected") {
              setStatus((prev) => {
                if (prev !== "playing") onPlaying?.();
                return "playing";
              });
            }
            if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") {
              if (!handled) { handled = true; scheduleRetry(); }
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Send offer immediately — don't wait for ICE gathering
          if (disposed) return;
          socket.send(JSON.stringify({
            type: "webrtc/offer",
            value: offer.sdp,
          }));
        } catch (e) {
          console.error("go2rtc: WebRTC offer failed", e);
          if (!handled) { handled = true; scheduleRetry(); }
        }
      };

      socket.onmessage = async (ev) => {
        if (disposed || typeof ev.data !== "string") return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "webrtc/answer") {
            await pc?.setRemoteDescription({ type: "answer", sdp: msg.value });
          } else if (msg.type === "webrtc/candidate") {
            if (msg.value) {
              await pc?.addIceCandidate({ candidate: msg.value, sdpMid: "0" });
            }
          } else if (msg.type === "error") {
            console.log("go2rtc:", msg.value);
            if (!handled) { handled = true; scheduleRetry(); }
          }
        } catch (e) {
          console.error("go2rtc: WebRTC message error", e);
        }
      };

      socket.onerror = () => {
        if (!disposed && !handled) { handled = true; scheduleRetry(); }
      };
      socket.onclose = () => {
        if (!disposed && !handled) { handled = true; scheduleRetry(); }
      };
    }

    function scheduleRetry() {
      cleanup();
      if (disposed) return;
      retryCount++;
      if (retryCount <= MAX_RETRIES) {
        setStatus("connecting");
        timer = setTimeout(connect, RETRY_DELAY);
      } else {
        setStatus("error");
      }
    }

    function cleanup() {
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
        ws = null;
      }
      if (pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
      }
      if (ms && ms.readyState === "open") {
        try { ms.endOfStream(); } catch { /* already closed */ }
      }
      if (video.src && !video.srcObject) {
        URL.revokeObjectURL(video.src);
      }
      video.srcObject = null;
      video.playbackRate = 1.0;
      ms = null;
    }

    connect();

    // Reset retry counter and reconnect when returning from background.
    // iOS kills WebRTC/WS connections aggressively; without this the
    // stream gets stuck in "error" after exhausting retries.
    function onVisibility() {
      if (document.visibilityState !== "visible" || disposed) return;
      // Check actual connection objects — not React state (stale closure)
      if (ws?.readyState === WebSocket.OPEN) return;
      if (pc?.connectionState === "connected") return;
      retryCount = 0;
      cleanup();
      connect();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      if (videoErrorHandler) video.removeEventListener("error", videoErrorHandler);
      cleanup();
    };
  }, [stream, connection, cameraEntity]);

  return { status, videoRef };
}
