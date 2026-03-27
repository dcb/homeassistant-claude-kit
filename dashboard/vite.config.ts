import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.ANALYZE
      ? [visualizer({ open: true, gzipSize: true, filename: "stats.html" })]
      : []),
  ],
  base: "/local/custom-dashboard/",
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_HA_URL || "http://homeassistant.local:8123",
        changeOrigin: true,
        ws: true,
      },
      "/local/snapshots": {
        target: process.env.VITE_HA_URL || "http://homeassistant.local:8123",
        changeOrigin: true,
      },
      "/media": {
        target: process.env.VITE_HA_URL || "http://homeassistant.local:8123",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    manifest: true,
  },
});
