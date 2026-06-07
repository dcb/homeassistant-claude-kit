import { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import {
  type ResolvedTheme,
  resolveTheme,
  themeChanged,
} from "../../lib/chart-plugins";

interface UPlotChartProps {
  buildOpts: (
    theme: ResolvedTheme,
    width: number,
    height: number,
  ) => uPlot.Options;
  data: uPlot.AlignedData;
  height?: number;
  className?: string;
  onScaleChange?: (xMin: number, xMax: number) => void;
  onResize?: (width: number) => void;
}

export function UPlotChart({
  buildOpts,
  data,
  height = 160,
  className,
  onScaleChange,
  onResize,
}: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const themeRef = useRef<ResolvedTheme | null>(null);
  const zoomedRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Stable refs for callbacks (avoid recreating chart on callback identity change)
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  // Create / recreate chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const theme = resolveTheme();
    themeRef.current = theme;

    const w = el.clientWidth;
    const h = height;
    const opts = buildOpts(theme, w, h);

    // Inject setScale hook for zoom tracking + legend sync
    const origHooks = opts.hooks ?? {};
    opts.hooks = {
      ...origHooks,
      setScale: [
        ...(Array.isArray(origHooks.setScale)
          ? origHooks.setScale
          : origHooks.setScale
            ? [origHooks.setScale]
            : []),
        (u: uPlot, scaleKey: string) => {
          if (scaleKey !== "x") return;
          const xScale = u.scales.x;
          if (xScale.min != null && xScale.max != null) {
            const fullMin = u.data[0][0];
            const fullMax = u.data[0][u.data[0].length - 1];
            zoomedRef.current =
              xScale.min > fullMin + 1 || xScale.max < fullMax - 1;
            onScaleChangeRef.current?.(xScale.min, xScale.max);
          }
        },
      ],
    };

    const chart = new uPlot(opts, dataRef.current, el);
    chartRef.current = chart;

    // ResizeObserver
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newW = Math.round(entry.contentRect.width);
      if (newW > 0 && chartRef.current) {
        chartRef.current.setSize({ width: newW, height });
        onResizeRef.current?.(newW);
      }
    });
    ro.observe(el);

    // MutationObserver for theme changes
    const mo = new MutationObserver(() => {
      const newTheme = resolveTheme();
      if (themeRef.current && themeChanged(themeRef.current, newTheme)) {
        themeRef.current = newTheme;
        // Recreate chart with new theme
        chartRef.current?.destroy();
        const newW = el.clientWidth;
        const newOpts = buildOpts(newTheme, newW, height);
        chartRef.current = new uPlot(newOpts, dataRef.current, el);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      ro.disconnect();
      mo.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [height, buildOpts]); // Recreate when height or options (plugins/spans) change

  // Update data without recreating
  useEffect(() => {
    if (chartRef.current && data) {
      chartRef.current.setData(data, !zoomedRef.current);
    }
  }, [data]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
