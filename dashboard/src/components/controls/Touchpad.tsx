import { useRef, useState, useEffect } from "react";
import type { RemoteAction } from "../../lib/tv-adapter";

interface TouchpadProps {
  onAction: (action: RemoteAction) => void;
  className?: string;
}

type SwipeDir = "up" | "down" | "left" | "right" | null;

const TAP_THRESHOLD = 10;
const SWIPE_THRESHOLD = 30;
const FLASH_MS = 150;

const accentFlash = "color-mix(in srgb, var(--color-accent) 15%, transparent)";

export function Touchpad({ onAction, className = "" }: TouchpadProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [flash, setFlash] = useState<SwipeDir>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const showFlash = (dir: SwipeDir) => {
    setFlash(dir);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    startRef.current = null;
    e.stopPropagation();
    if (!hasInteracted) setHasInteracted(true);

    if (dist < TAP_THRESHOLD) {
      onAction("ok");
      return;
    }
    if (dist < SWIPE_THRESHOLD) return; // dead zone

    // Determine dominant axis
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? "right" : "left";
      showFlash(dir);
      onAction(dir);
    } else {
      const dir = dy > 0 ? "down" : "up";
      showFlash(dir);
      onAction(dir);
    }
  };

  const onPointerCancel = () => {
    startRef.current = null;
  };

  // Gradient position for directional flash
  const flashGradient = flash
    ? {
        up: `radial-gradient(ellipse at 50% 0%, ${accentFlash}, transparent 60%)`,
        down: `radial-gradient(ellipse at 50% 100%, ${accentFlash}, transparent 60%)`,
        left: `radial-gradient(ellipse at 0% 50%, ${accentFlash}, transparent 60%)`,
        right: `radial-gradient(ellipse at 100% 50%, ${accentFlash}, transparent 60%)`,
      }[flash]
    : undefined;

  return (
    <div
      data-no-drag
      className={`w-full min-h-0 shrink rounded-[22px] touch-none select-none ${className}`}
      style={{
        aspectRatio: "1",
        background: flashGradient
          ?? "linear-gradient(145deg, var(--color-bg-elevated), var(--color-bg-card))",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3)",
        transition: "background 0.15s ease",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="flex h-full items-center justify-center">
        <span
          className="text-[10px] font-light uppercase tracking-[4px] text-white/10 transition-opacity duration-500"
          style={{ opacity: hasInteracted ? 0 : 1 }}
        >
          Swipe · Tap
        </span>
      </div>
    </div>
  );
}
