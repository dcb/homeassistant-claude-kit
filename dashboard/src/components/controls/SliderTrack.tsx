import type { SliderControlReturn } from "../../lib/useSliderControl";
import { DragBubble } from "./DragBubble";

export interface SliderTrackProps {
  slider: SliderControlReturn;
  /** CSS background value for track & fill (uses opacity-30/70 layers) */
  trackGradient?: string;
  /** Tailwind class for track bg when no gradient (default: bg-white/15) */
  trackClass?: string;
  /** Tailwind class for fill bg when no gradient (default: bg-accent/70) */
  fillClass?: string;
  formatValue?: (v: number) => string;
}

export function SliderTrack({
  slider,
  trackGradient,
  trackClass = "bg-white/15",
  fillClass = "bg-accent/70",
  formatValue,
}: SliderTrackProps) {
  const { phase, ratio } = slider;

  const thumbColorClass =
    phase === "inflight"
      ? "bg-amber-400 animate-slider-glow"
      : "bg-white";

  const thumbScaleClass = slider.dragging ? "scale-125" : "";

  const wrapperClass =
    phase === "correction" ? "animate-shake" : "";

  return (
    <div
      ref={slider.containerRef}
      className={`relative flex-1 h-11 flex items-center touch-none cursor-pointer ${wrapperClass}`}
      onPointerDown={slider.onPointerDown}
      onPointerMove={slider.onPointerMove}
      onPointerUp={slider.onPointerUp}
      onPointerCancel={slider.onPointerCancel}
    >
      {/* Track background */}
      <div
        className={`absolute left-0 right-0 h-1.5 rounded-full ${trackGradient ? "opacity-30" : trackClass}`}
        style={trackGradient ? { background: trackGradient } : undefined}
      />
      {/* Active fill */}
      <div
        className={`absolute left-0 h-1.5 rounded-full ${trackGradient ? "opacity-70" : fillClass}`}
        style={{
          width: `${ratio * 100}%`,
          ...(trackGradient ? {
            backgroundImage: trackGradient,
            backgroundSize: ratio > 0.01 ? `${(1 / ratio) * 100}% 100%` : undefined,
            backgroundRepeat: "no-repeat",
          } : {}),
        }}
      />
      {/* Custom thumb — inset so edges stay within track */}
      <div
        className={`pointer-events-none absolute h-5 w-5 rounded-full shadow-md ${thumbColorClass} ${thumbScaleClass}`}
        style={{ left: `calc(${ratio} * (100% - 20px))` }}
      />
      {/* Drag value bubble */}
      {formatValue && (
        <DragBubble visible={slider.dragging} value={formatValue(slider.displayValue)} ratio={ratio} />
      )}
    </div>
  );
}
