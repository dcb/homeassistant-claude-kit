import { useState, useRef, useCallback } from "react";
import { useControlCommit } from "../../lib/useControlCommit";

/* ── Battery gauge with draggable charge limit ────────────────── */

interface BatteryGaugeProps {
  battery: number | null;
  usableBattery: number | null;
  chargeLimit: number | null;
  batteryColor: string;
  isCharging: boolean;
  estRangeKm: number | null;
  onChargeLimitChange: (limit: number) => void;
}

export function BatteryGauge({
  battery,
  usableBattery,
  chargeLimit,
  batteryColor,
  isCharging,
  estRangeKm,
  onChargeLimitChange,
}: BatteryGaugeProps) {
  const coldBuffer = battery !== null && usableBattery !== null && battery > usableBattery
    ? battery - usableBattery : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const control = useControlCommit<number>(
    chargeLimit ?? 80,
    onChargeLimitChange,
  );

  // During drag, show dragValue; after drag ends (inflight/debouncing/correction), show control.displayValue
  const displayLimit = dragging && dragValue !== null ? dragValue : control.displayValue;
  const isPending = control.phase !== "idle";

  const calcPercent = useCallback((clientX: number) => {
    if (!barRef.current) return null;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.round(((clientX - rect.left) / rect.width) * 100);
    // Snap to 5% steps, clamp 50-100
    return Math.max(50, Math.min(100, Math.round(pct / 5) * 5));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const val = calcPercent(e.clientX);
    if (val === null) return;
    setDragging(true);
    setDragValue(val);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [calcPercent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const val = calcPercent(e.clientX);
    if (val !== null) setDragValue(val);
  }, [dragging, calcPercent]);

  const handlePointerUp = useCallback(() => {
    if (dragging && dragValue !== null && dragValue !== chargeLimit) {
      control.set(dragValue);
      control.commit();
    }
    setDragging(false);
    setDragValue(null);
  }, [dragging, dragValue, chargeLimit, control]);

  return (
    <div className="mb-4">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {battery !== null ? `${Math.round(battery)}%` : "\u2014"}
          </span>
          {estRangeKm !== null && (
            <span className="text-sm tabular-nums text-text-secondary">
              Est. {estRangeKm} km
            </span>
          )}
        </div>
        {displayLimit !== null && (
          <span className={`text-xs tabular-nums ${dragging || isPending ? "text-text-primary" : "text-text-secondary"}`}>
            Limit: {Math.round(displayLimit)}%
          </span>
        )}
      </div>
      <div
        ref={barRef}
        className={`relative mt-2 h-11 flex items-center cursor-ew-resize touch-none ${control.phase === "correction" ? "animate-shake" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Bar track (clipped) — visually centered within 44px touch strip */}
        <div className="absolute inset-x-0 h-2.5 overflow-hidden rounded-full bg-bg-elevated">
          {/* Battery fill — usable portion */}
          <div
            className={`absolute inset-y-0 left-0 transition-all ${dragging ? "duration-0" : "duration-500"} ${batteryColor}`}
            style={{ width: `${(battery ?? 0) - coldBuffer}%` }}
          />
          {/* Cold buffer portion — striped/dimmed */}
          {coldBuffer > 0 && (
            <div
              className={`absolute inset-y-0 transition-all ${dragging ? "duration-0" : "duration-500"} ${batteryColor} opacity-40`}
              style={{ left: `${(battery ?? 0) - coldBuffer}%`, width: `${coldBuffer}%` }}
            />
          )}
          {/* Charging shimmer — sweeps from fill to charge limit */}
          {isCharging && (
            <div
              className="absolute inset-y-0 left-0 battery-charging pointer-events-none"
              style={{ width: `${displayLimit ?? battery ?? 0}%` }}
            />
          )}
          {/* Target zone (between battery and limit) */}
          {displayLimit !== null && battery !== null && displayLimit > battery && (
            <div
              className="absolute inset-y-0 opacity-20"
              style={{
                left: `${battery}%`,
                width: `${displayLimit - battery}%`,
                backgroundColor: "currentColor",
              }}
            />
          )}
        </div>
        {/* Charge limit handle (outside clip) */}
        {displayLimit !== null && (
          <div
            className={`absolute top-1/2 h-6 w-6 rounded-full transition-all ${
              dragging
                ? "bg-text-primary scale-110 duration-0"
                : isPending
                  ? "bg-accent-warm duration-300"
                  : "bg-text-secondary duration-300"
            }`}
            style={{ left: `${displayLimit}%`, transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>
    </div>
  );
}
