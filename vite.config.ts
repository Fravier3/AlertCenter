import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/AlertCenter/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/AlertCenter/",
        name: "PR Alert Center",
        short_name: "Alert Center",
        description:
          "Clima, alertas y actividad sísmica de Puerto Rico, Bogotá y Cundinamarca.",
        start_url: "/AlertCenter/",
        scope: "/AlertCenter/",
        display: "standalone",
        background_color: "#080e1b",
        theme_color: "#080e1b",
        lang: "es",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "/AlertCenter/index.html",
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
  build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
});
