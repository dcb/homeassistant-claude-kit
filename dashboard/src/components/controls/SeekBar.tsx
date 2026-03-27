import { useState, useEffect } from "react";
import { useSliderControl } from "../../lib/useSliderControl";
import type { ControlGroup } from "../../lib/useControlGroup";

export interface SeekBarProps {
  position: number;
  duration: number;
  updatedAt: string | undefined;
  isPlaying: boolean;
  canSeek: boolean;
  onSeek?: (seconds: number) => void;
  /** "full" shows time labels + thumb; "slim" is a thin bar only (for card embed) */
  variant?: "full" | "slim";
  group?: ControlGroup;
}

function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const sss = String(ss).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`;
}

export function SeekBar({
  position,
  duration,
  updatedAt,
  isPlaying,
  canSeek,
  onSeek,
  variant = "full",
  group,
}: SeekBarProps) {
  // Live position interpolation (ticks every 1s while playing)
  const [interpolated, setInterpolated] = useState(position);

  useEffect(() => {
    if (!isPlaying || !updatedAt) {
      setInterpolated(position);
      return;
    }
    const update = () => {
      const elapsed = (Date.now() - new Date(updatedAt).getTime()) / 1000;
      setInterpolated(Math.min(position + elapsed, duration));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [position, updatedAt, isPlaying, duration]);

  // Unified slider — called unconditionally (hooks rule)
  const safeDuration = Math.max(1, Math.round(duration));
  const slider = useSliderControl(
    Math.round(interpolated),
    (seconds) => { onSeek?.(seconds); },
    { min: 0, max: safeDuration, step: 1, group },
  );

  const ratio = duration > 0 ? Math.min(interpolated / duration, 1) : 0;
  const displayTime = canSeek ? slider.displayValue : interpolated;

  // --- Slim variant: thin display-only bar (for MediaPlayerCard embed) ---
  if (variant === "slim") {
    return (
      <div className="h-[3px] w-full bg-white/10">
        <div
          className="h-full bg-accent/70 transition-[width] duration-1000 ease-linear"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    );
  }

  // --- Full variant: seek-specific track (visually distinct from volume slider) ---
  const trackRatio = canSeek ? slider.ratio : ratio;
  const thumbSize = 12;

  return (
    <div>
      {/* Time labels */}
      <div className="flex justify-between px-0.5 text-[10px] tabular-nums text-text-dim">
        <span>{formatTime(displayTime)}</span>
        <span>-{formatTime(Math.max(0, duration - displayTime))}</span>
      </div>

      {/* Seek track */}
      <div
        ref={canSeek ? slider.containerRef : undefined}
        className={`group relative h-8 flex items-center touch-none ${canSeek ? "cursor-pointer" : ""}`}
        onPointerDown={canSeek ? slider.onPointerDown : undefined}
        onPointerMove={canSeek ? slider.onPointerMove : undefined}
        onPointerUp={canSeek ? slider.onPointerUp : undefined}
        onPointerCancel={canSeek ? slider.onPointerCancel : undefined}
      >
        {/* Track background — thinner than volume */}
        <div className="absolute left-0 right-0 h-[3px] rounded-full bg-white/10" />
        {/* Elapsed fill */}
        <div
          className="absolute left-0 h-[3px] rounded-full bg-white/60"
          style={{
            width: `${trackRatio * 100}%`,
            ...(!canSeek ? { transition: "width 1s linear" } : {}),
          }}
        />
        {/* Thumb — small dot, grows on drag */}
        {canSeek && (
          <div
            className={`pointer-events-none absolute rounded-full bg-white shadow-sm transition-transform duration-150 ${slider.dragging ? "scale-150" : "scale-100 group-hover:scale-125"}`}
            style={{
              width: thumbSize,
              height: thumbSize,
              left: `calc(${trackRatio} * (100% - ${thumbSize}px))`,
            }}
          />
        )}
      </div>
    </div>
  );
}
