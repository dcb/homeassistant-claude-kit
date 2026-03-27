import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useControlCommit } from "../../lib/useControlCommit";

// --- Color helpers ---

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  // h: 0-360, s: 0-1, v: 0-1
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s]; // only hue + saturation (brightness handled separately)
}

/** Standard color presets */
const COLOR_PRESETS: { label: string; rgb: [number, number, number] }[] = [
  { label: "Red", rgb: [255, 0, 0] },
  { label: "Orange", rgb: [255, 120, 0] },
  { label: "Yellow", rgb: [255, 220, 0] },
  { label: "Green", rgb: [0, 255, 0] },
  { label: "Cyan", rgb: [0, 255, 255] },
  { label: "Blue", rgb: [0, 80, 255] },
  { label: "Purple", rgb: [160, 0, 255] },
  { label: "Pink", rgb: [255, 0, 128] },
  { label: "White", rgb: [255, 255, 255] },
];

// --- Component ---

export interface ColorPickerPopupProps {
  open: boolean;
  onClose: () => void;
  currentRgb: [number, number, number];
  onChange: (rgb: [number, number, number]) => void;
}

function rgbEqual(a: [number, number, number], b: [number, number, number]) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function ColorPickerPopup({
  open,
  onClose,
  currentRgb,
  onChange,
}: ColorPickerPopupProps) {
  const [hs, setHs] = useState<[number, number]>(() => rgbToHsv(...currentRgb));
  const wheelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { set, commit, phase } = useControlCommit<[number, number, number]>(
    currentRgb,
    onChange,
    { debounceMs: 150, isEqual: rgbEqual },
  );

  // Sync HS display state when opened with a new color
  useEffect(() => {
    if (open) setHs(rgbToHsv(...currentRgb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateFromPointer = useCallback((clientX: number, clientY: number, doCommit: boolean) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    const sat = dist / radius;
    let hue = Math.atan2(dy, dx) * (180 / Math.PI);
    if (hue < 0) hue += 360;

    setHs([hue, sat]);
    const rgb = hsvToRgb(hue, sat, 1);
    set(rgb);
    if (doCommit) commit();
  }, [set, commit]);

  // Thumb position from current HS
  const angle = hs[0] * (Math.PI / 180);
  const thumbX = 50 + hs[1] * 50 * Math.cos(angle);
  const thumbY = 50 + hs[1] * 50 * Math.sin(angle);
  const preview = hsvToRgb(hs[0], hs[1], 1);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-t-2xl bg-bg-card p-4 md:rounded-2xl"
          >
            {/* Preview + close */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: `rgb(${preview[0]},${preview[1]},${preview[2]})` }}
                />
                <span className="text-sm font-medium">Color</span>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-text-dim hover:bg-white/10 active:bg-white/10"
              >
                <Icon icon="mdi:close" width={18} />
              </button>
            </div>

            {/* Color wheel */}
            <div
              ref={wheelRef}
              className={`relative mx-auto aspect-square w-64 cursor-crosshair rounded-full transition-shadow ${
                phase === "debouncing" || phase === "inflight"
                  ? "ring-2 ring-accent-warm"
                  : phase === "correction"
                    ? "animate-shake"
                    : ""
              }`}
              style={{
                background: `
                  radial-gradient(circle, white 0%, rgba(255,255,255,0.15) 50%, transparent 70%),
                  conic-gradient(from 90deg,
                    hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
                    hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
                    hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
                    hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
                    hsl(360,100%,50%))
                `,
                touchAction: "none",
              }}
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                updateFromPointer(e.clientX, e.clientY, false);
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) updateFromPointer(e.clientX, e.clientY, false);
              }}
              onPointerUp={(e) => {
                updateFromPointer(e.clientX, e.clientY, true);
              }}
            >
              {/* Thumb */}
              <div
                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_6px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${thumbX}%`,
                  top: `${thumbY}%`,
                  backgroundColor: `rgb(${preview[0]},${preview[1]},${preview[2]})`,
                }}
              />
            </div>

            {/* Preset colors */}
            <div className="mt-4">
              <div className="flex flex-wrap justify-center gap-2.5">
                {COLOR_PRESETS.map((preset) => {
                  const isActive =
                    Math.abs(preview[0] - preset.rgb[0]) < 20 &&
                    Math.abs(preview[1] - preset.rgb[1]) < 20 &&
                    Math.abs(preview[2] - preset.rgb[2]) < 20;
                  return (
                    <button
                      key={preset.label}
                      title={preset.label}
                      onClick={() => {
                        setHs(rgbToHsv(...preset.rgb));
                        set(preset.rgb);
                        commit();
                      }}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        isActive ? "scale-110 border-white" : "border-white/20 hover:scale-105 active:scale-105"
                      }`}
                      style={{
                        backgroundColor: `rgb(${preset.rgb[0]},${preset.rgb[1]},${preset.rgb[2]})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
