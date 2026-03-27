import type uPlot from "uplot";

// ---- Resolved theme (CSS vars → concrete hex) ----

export interface ResolvedTheme {
  accent: string;
  accentWarm: string;
  accentCool: string;
  accentGreen: string;
  accentViolet: string;
  accentBlue: string;
  accentRed: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  bgCard: string;
  bgElevated: string;
}

const VAR_MAP: Record<keyof ResolvedTheme, string> = {
  accent: "--color-accent",
  accentWarm: "--color-accent-warm",
  accentCool: "--color-accent-cool",
  accentGreen: "--color-accent-green",
  accentViolet: "--color-accent-violet",
  accentBlue: "--color-accent-blue",
  accentRed: "--color-accent-red",
  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  textDim: "--color-text-dim",
  bgCard: "--color-bg-card",
  bgElevated: "--color-bg-elevated",
};

export function resolveTheme(): ResolvedTheme {
  const s = getComputedStyle(document.documentElement);
  const t = {} as Record<string, string>;
  for (const [key, varName] of Object.entries(VAR_MAP)) {
    t[key] = s.getPropertyValue(varName).trim();
  }
  return t as unknown as ResolvedTheme;
}

/** Resolve a CSS `var(--name)` string to its computed hex value. */
export function resolveCssColor(varStr: string): string {
  const match = varStr.match(/var\(([^)]+)\)/);
  if (!match) return varStr; // already a raw color
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
}

export function themeChanged(a: ResolvedTheme, b: ResolvedTheme): boolean {
  for (const k of Object.keys(VAR_MAP) as (keyof ResolvedTheme)[]) {
    if (a[k] !== b[k]) return true;
  }
  return false;
}

// ---- Heating spans plugin ----

export interface HeatingSpan {
  start: number; // epoch-seconds
  end: number;   // epoch-seconds
}

export function heatingSpansPlugin(
  spans: HeatingSpan[],
  color: string,
): uPlot.Plugin {
  return {
    hooks: {
      drawClear: (u: uPlot) => {
        if (spans.length === 0) return;
        const { ctx } = u;
        const { left, top, width, height } = u.bbox;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();
        ctx.fillStyle = color;
        for (const s of spans) {
          const x1 = u.valToPos(s.start, "x", true);
          const x2 = u.valToPos(s.end, "x", true);
          const clampX1 = Math.max(x1, left);
          const clampX2 = Math.min(x2, left + width);
          if (clampX1 < clampX2) {
            ctx.fillRect(clampX1, top, clampX2 - clampX1, height);
          }
        }
        ctx.restore();
      },
    },
  };
}

export interface ColoredSpan extends HeatingSpan {
  color: string; // resolved hex color
}

/** Draw diagonal-striped bands for AC activity (visually distinct from boiler solid fill). */
export function acSpansPlugin(spans: ColoredSpan[]): uPlot.Plugin {
  return {
    hooks: {
      drawClear: (u: uPlot) => {
        if (spans.length === 0) return;
        const { ctx } = u;
        const { left, top, width, height } = u.bbox;
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, width, height);
        ctx.clip();

        for (const s of spans) {
          const x1 = u.valToPos(s.start, "x", true);
          const x2 = u.valToPos(s.end, "x", true);
          const cx1 = Math.max(x1, left);
          const cx2 = Math.min(x2, left + width);
          if (cx1 >= cx2) continue;

          // Draw diagonal stripes using a tiny offscreen pattern
          const gap = 6; // px between stripes
          const sw = 1.5; // stripe width
          const patSize = gap * 2;
          const pat = document.createElement("canvas");
          pat.width = patSize;
          pat.height = patSize;
          const pc = pat.getContext("2d")!;
          pc.strokeStyle = s.color;
          pc.lineWidth = sw;
          // Two diagonal lines across the tile
          pc.beginPath();
          pc.moveTo(0, patSize);
          pc.lineTo(patSize, 0);
          pc.moveTo(-patSize / 2, patSize / 2);
          pc.lineTo(patSize / 2, -patSize / 2);
          pc.moveTo(patSize / 2, patSize * 1.5);
          pc.lineTo(patSize * 1.5, patSize / 2);
          pc.stroke();

          const pattern = ctx.createPattern(pat, "repeat")!;
          ctx.fillStyle = pattern;
          ctx.fillRect(cx1, top, cx2 - cx1, height);
        }
        ctx.restore();
      },
    },
  };
}

// ---- Tooltip plugin ----

export interface TooltipRow {
  color: string;
  label: string;
  value: string;
}

export type TooltipFormatter = (
  idx: number,
  data: uPlot.AlignedData,
  theme: ResolvedTheme,
) => TooltipRow[];

/** Create a styled DOM element for the tooltip dot indicator. */
function createDot(color: string): HTMLSpanElement {
  const dot = document.createElement("span");
  Object.assign(dot.style, {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: color,
    flexShrink: "0",
  });
  return dot;
}

export function tooltipPlugin(
  formatRows: TooltipFormatter,
  theme: ResolvedTheme,
  formatTime?: (epochSec: number) => string,
): uPlot.Plugin {
  let tooltip: HTMLDivElement | null = null;

  const defaultFormatTime = (sec: number) =>
    new Date(sec * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const timeFn = formatTime ?? defaultFormatTime;

  return {
    hooks: {
      init: (u: uPlot) => {
        tooltip = document.createElement("div");
        Object.assign(tooltip.style, {
          position: "absolute",
          pointerEvents: "none",
          zIndex: "10",
          padding: "6px 10px",
          borderRadius: "8px",
          fontSize: "11px",
          lineHeight: "1.5",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          backgroundColor: theme.bgElevated,
          color: theme.textPrimary,
          opacity: "0",
          transition: "opacity 0.1s",
          whiteSpace: "nowrap",
        });
        u.over.appendChild(tooltip);
      },
      setCursor: (u: uPlot) => {
        if (!tooltip) return;
        const idx = u.cursor.idx;
        if (idx == null || idx < 0) {
          tooltip.style.opacity = "0";
          return;
        }
        const rows = formatRows(idx, u.data, theme);
        if (rows.length === 0) {
          tooltip.style.opacity = "0";
          return;
        }
        const ts = u.data[0][idx];
        const timeStr = timeFn(ts);

        // Build tooltip DOM safely (no innerHTML)
        tooltip.textContent = "";

        const header = document.createElement("div");
        header.style.color = theme.textDim;
        header.style.marginBottom = "3px";
        header.textContent = timeStr;
        tooltip.appendChild(header);

        for (const r of rows) {
          const row = document.createElement("div");
          Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            gap: "6px",
          });
          row.appendChild(createDot(r.color));

          const val = document.createElement("span");
          val.textContent = r.value;
          row.appendChild(val);

          const lbl = document.createElement("span");
          lbl.style.color = theme.textDim;
          lbl.textContent = r.label;
          row.appendChild(lbl);

          tooltip.appendChild(row);
        }

        tooltip.style.opacity = "1";

        // Position: prefer right of cursor, flip if near edge
        const { left: cursorLeft } = u.cursor;
        const overRect = u.over.getBoundingClientRect();
        const tw = tooltip.offsetWidth;
        const pad = 12;
        let x = (cursorLeft ?? 0) + pad;
        if (x + tw > overRect.width) {
          x = (cursorLeft ?? 0) - tw - pad;
        }
        tooltip.style.left = `${Math.max(0, x)}px`;
        tooltip.style.top = `${pad}px`;
      },
      destroy: () => {
        tooltip?.remove();
        tooltip = null;
      },
    },
  };
}

// ---- Stacked series helper ----

/**
 * Pre-accumulate y-values for stacked areas and generate band configs.
 * Mutates data in-place for the stacked indices, returns band definitions.
 * seriesIndices should be in stack order (bottom to top).
 */
export function stackData(
  data: uPlot.AlignedData,
  seriesIndices: number[],
): uPlot.Band[] {
  if (seriesIndices.length < 2) return [];

  const len = data[0].length;

  // Accumulate bottom-up
  for (let si = 1; si < seriesIndices.length; si++) {
    const curIdx = seriesIndices[si];
    const prevIdx = seriesIndices[si - 1];
    const cur = data[curIdx] as (number | null)[];
    const prev = data[prevIdx] as (number | null)[];
    const out = new Array(len);
    for (let i = 0; i < len; i++) {
      const c = cur[i];
      const p = prev[i];
      out[i] = c != null && p != null ? c + p : c != null ? c : p;
    }
    (data as (number | null | undefined)[][])[curIdx] = out;
  }

  // Generate bands (fill between adjacent stacked series)
  const bands: uPlot.Band[] = [];
  for (let si = seriesIndices.length - 1; si > 0; si--) {
    bands.push({
      series: [seriesIndices[si], seriesIndices[si - 1]],
    });
  }
  return bands;
}

// ---- Shared axis helpers ----

export function axisDefaults(theme: ResolvedTheme): Partial<uPlot.Axis> {
  return {
    stroke: theme.textDim,
    grid: { stroke: `${theme.textDim}18`, width: 1 },
    ticks: { show: false },
    font: `10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    gap: 4,
  };
}

// ---- Canvas gradient helper ----

export function verticalGradient(
  u: uPlot,
  color: string,
  opacityTop: number,
  opacityBottom: number,
): CanvasGradient {
  const { top, height } = u.bbox;
  // During legend init, bbox may not be laid out yet — use fallback range
  const y0 = Number.isFinite(top) ? top : 0;
  const y1 = Number.isFinite(top + height) ? top + height : 1;
  const g = u.ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, hexWithAlpha(color, opacityTop));
  g.addColorStop(1, hexWithAlpha(color, opacityBottom));
  return g;
}

// ---- Gesture zoom/pan plugin ----

/**
 * Adds pinch-to-zoom, wheel zoom, pan (when zoomed), and double-tap/click
 * to reset or zoom. Toggles uPlot's built-in drag-to-zoom off when zoomed
 * so single-finger drag becomes pan.
 */
export function chartGesturesPlugin(
  dayRange: [number, number],
  beforeZoom: (min: number, max: number) => void,
): uPlot.Plugin {
  const [fullMin, fullMax] = dayRange;
  const MIN_SPAN = 15 * 60; // 15 min in seconds
  const ZOOM_STEP = 0.15;
  const DBL_TAP_MS = 300;
  const DBL_TAP_PX = 30;
  const PAN_THRESH = 5; // px before pan activates

  let cleanup: (() => void) | null = null;
  let wasZoomed = false;

  const isZoomed = (u: uPlot) => {
    const xMin = u.scales.x.min ?? fullMin;
    const xMax = u.scales.x.max ?? fullMax;
    return xMin > fullMin + 1 || xMax < fullMax - 1;
  };

  const clampRange = (min: number, max: number): [number, number] => {
    let span = max - min;
    if (span < MIN_SPAN) {
      const c = (min + max) / 2;
      min = c - MIN_SPAN / 2;
      max = c + MIN_SPAN / 2;
      span = MIN_SPAN;
    }
    if (span >= fullMax - fullMin) return [fullMin, fullMax];
    if (min < fullMin) { min = fullMin; max = fullMin + span; }
    if (max > fullMax) { max = fullMax; min = fullMax - span; }
    return [min, max];
  };

  /** Signal zoom intent then apply via setScale. */
  const doZoom = (u: uPlot, min: number, max: number) => {
    const [cMin, cMax] = clampRange(min, max);
    beforeZoom(cMin, cMax);
    u.setScale("x", { min: cMin, max: cMax });
  };

  return {
    hooks: {
      init: (u: uPlot) => {
        const over = u.over;

        // --- state ---
        let isPinching = false;
        let pinchDist0 = 0;
        let pinchMin0 = 0;
        let pinchMax0 = 0;
        let pinchCenter = 0;

        let isPanning = false;
        let panActive = false;
        let panX0 = 0;
        let panMin0 = 0;
        let panMax0 = 0;

        let lastTapTime = 0;
        let lastTapX = 0;
        let lastTapY = 0;

        // --- helpers ---
        const overX = (cx: number) => cx - over.getBoundingClientRect().left;

        const tDist = (ts: TouchList) => {
          const dx = ts[1].clientX - ts[0].clientX;
          const dy = ts[1].clientY - ts[0].clientY;
          return Math.sqrt(dx * dx + dy * dy);
        };

        // --- touch ---
        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length === 2) {
            isPinching = true;
            isPanning = false;
            panActive = false;
            pinchDist0 = tDist(e.touches);
            pinchMin0 = u.scales.x.min ?? fullMin;
            pinchMax0 = u.scales.x.max ?? fullMax;
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            pinchCenter = u.posToVal(overX(mx), "x");
            e.preventDefault();
          } else if (e.touches.length === 1 && isZoomed(u)) {
            isPanning = true;
            panActive = false;
            panX0 = e.touches[0].clientX;
            panMin0 = u.scales.x.min ?? fullMin;
            panMax0 = u.scales.x.max ?? fullMax;
            e.preventDefault();
          }
        };

        const onTouchMove = (e: TouchEvent) => {
          if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            const d = tDist(e.touches);
            const ratio = pinchDist0 / d;
            const span0 = pinchMax0 - pinchMin0;
            const span = span0 * ratio;
            const frac = (pinchCenter - pinchMin0) / span0;
            doZoom(u,
              pinchCenter - span * frac,
              pinchCenter + span * (1 - frac),
            );
          } else if (isPanning && e.touches.length === 1) {
            const dx = e.touches[0].clientX - panX0;
            if (!panActive && Math.abs(dx) < PAN_THRESH) return;
            panActive = true;
            e.preventDefault();
            const w = over.getBoundingClientRect().width;
            const span = panMax0 - panMin0;
            const dd = -(dx / w) * span;
            doZoom(u, panMin0 + dd, panMax0 + dd);
          }
        };

        const onTouchEnd = (e: TouchEvent) => {
          if (isPinching) { isPinching = false; return; }
          if (isPanning) { isPanning = false; panActive = false; return; }

          // double-tap detection
          if (e.changedTouches.length === 1) {
            const t = e.changedTouches[0];
            const now = Date.now();
            const dx = Math.abs(t.clientX - lastTapX);
            const dy = Math.abs(t.clientY - lastTapY);
            if (now - lastTapTime < DBL_TAP_MS && dx < DBL_TAP_PX && dy < DBL_TAP_PX) {
              e.preventDefault();
              if (isZoomed(u)) {
                doZoom(u, fullMin, fullMax);
              } else {
                const cx = u.posToVal(overX(t.clientX), "x");
                const curMin = u.scales.x.min ?? fullMin;
                const curMax = u.scales.x.max ?? fullMax;
                const s = (curMax - curMin) / 2;
                doZoom(u, cx - s / 2, cx + s / 2);
              }
              lastTapTime = 0;
            } else {
              lastTapTime = now;
              lastTapX = t.clientX;
              lastTapY = t.clientY;
            }
          }
        };

        // --- mouse pan (desktop, when zoomed) ---
        const onMouseDown = (e: MouseEvent) => {
          if (e.button !== 0 || !isZoomed(u)) return;
          isPanning = true;
          panActive = false;
          panX0 = e.clientX;
          panMin0 = u.scales.x.min ?? fullMin;
          panMax0 = u.scales.x.max ?? fullMax;
        };

        const onMouseMove = (e: MouseEvent) => {
          if (!isPanning) return;
          const dx = e.clientX - panX0;
          if (!panActive && Math.abs(dx) < PAN_THRESH) return;
          panActive = true;
          const w = over.getBoundingClientRect().width;
          const span = panMax0 - panMin0;
          const dd = -(dx / w) * span;
          doZoom(u, panMin0 + dd, panMax0 + dd);
        };

        const onMouseUp = () => {
          isPanning = false;
          panActive = false;
        };

        // --- wheel zoom ---
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const cx = u.posToVal(overX(e.clientX), "x");
          const curMin = u.scales.x.min ?? fullMin;
          const curMax = u.scales.x.max ?? fullMax;
          const span = curMax - curMin;
          const dir = e.deltaY > 0 ? 1 : -1; // positive = zoom out
          const newSpan = span * (1 + ZOOM_STEP * dir);
          const frac = (cx - curMin) / span;
          doZoom(u,
            cx - newSpan * frac,
            cx + newSpan * (1 - frac),
          );
        };

        // --- double-click (desktop) ---
        const onDblClick = (e: MouseEvent) => {
          e.preventDefault();
          isPanning = false;
          panActive = false;
          if (isZoomed(u)) {
            doZoom(u, fullMin, fullMax);
          } else {
            const cx = u.posToVal(overX(e.clientX), "x");
            const curMin = u.scales.x.min ?? fullMin;
            const curMax = u.scales.x.max ?? fullMax;
            const s = (curMax - curMin) / 2;
            doZoom(u, cx - s / 2, cx + s / 2);
          }
        };

        // --- attach ---
        over.style.touchAction = "none";

        over.addEventListener("touchstart", onTouchStart, { passive: false });
        over.addEventListener("touchmove", onTouchMove, { passive: false });
        over.addEventListener("touchend", onTouchEnd);
        over.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        over.addEventListener("wheel", onWheel, { passive: false });
        over.addEventListener("dblclick", onDblClick);

        cleanup = () => {
          over.removeEventListener("touchstart", onTouchStart);
          over.removeEventListener("touchmove", onTouchMove);
          over.removeEventListener("touchend", onTouchEnd);
          over.removeEventListener("mousedown", onMouseDown);
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          over.removeEventListener("wheel", onWheel);
          over.removeEventListener("dblclick", onDblClick);
        };
      },
      setScale: (u: uPlot, key: string) => {
        if (key !== "x") return;
        const z = isZoomed(u);
        if (z !== wasZoomed) {
          // Toggle: selection rectangle when full view, pan when zoomed
          u.cursor.drag!.x = !z;
          wasZoomed = z;
        }
      },
      destroy: () => {
        cleanup?.();
        cleanup = null;
        wasZoomed = false;
      },
    },
  };
}

// ---- Canvas gradient helper (internal) ----

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  // Handle both #rgb and #rrggbb
  if (hex.length === 4) {
    const r = hex[1], g = hex[2], b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}${a}`;
  }
  return `${hex.slice(0, 7)}${a}`;
}
