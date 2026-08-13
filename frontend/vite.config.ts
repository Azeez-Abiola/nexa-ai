import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const backendHost = process.env.BACKEND_HOST || "localhost";
const backendPort = process.env.BACKEND_PORT || "4000";
const backendUrl = `http://${backendHost}:${backendPort}`;

export default defineConfig({
  appType: 'spa',
  plugins: [
    react(),
    VitePWA({
      // Ship updates the moment they deploy. An assistant people sign into daily should
      // never be running last week's build because nobody thought to reinstall it.
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "1879-22.png"],
      manifest: {
        name: "Nexa AI",
        short_name: "Nexa",
        description: "Your UAC assistant, on every device.",
        // Installed users are signing in to work, not reading the marketing page.
        start_url: "/user-chat",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#ffffff",
        theme_color: "#ed0000",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          // Android crops icons to the launcher's own shape, so this one keeps her
          // inside the safe zone and lets the red bleed to the edges.
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // The preloader video is 4MB and plays once at startup; precaching it would make
        // every install download it up front for no benefit.
        // The wake word engine is megabytes and opt-in, so it is fetched on demand rather
        // than pushed to every install. The preloader video is 4MB and plays once.
        globIgnores: ["**/*.mp4", "**/vendor-wakeword-*.js", "**/*.pv", "**/*.ppn"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Offline navigation serves the SPA shell, but the API must never be answered
        // from a cache: stale chat history and stale auth are worse than an honest error.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/health/, /^\/logos/],
        // A signed-in assistant is useless offline anyway, so nothing is served stale
        // once the network is reachable again.
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Keep the service worker out of the way while developing; a stale worker caching
        // dev assets is a confusing class of bug to chase.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.socket?.setNoDelay(true);
            }
          });
        },
      },
      "/logos": {
        target: backendUrl,
        changeOrigin: true,
      },
      "/health": {
        target: backendUrl,
        changeOrigin: true,
      }
    },
    middlewareMode: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['react-icons', 'framer-motion'],
          'vendor-export': ['html2canvas', 'jspdf', 'docx'],
          'vendor-axios': ['axios'],
          // The wake word engine inlines its WASM as base64, so left alone it lands in
          // the entry chunk and doubles the first-load cost for everyone, including the
          // majority who never switch the feature on. Pinning it to its own chunk keeps
          // it behind the dynamic import it is actually loaded by.
          'vendor-wakeword': ['@picovoice/porcupine-web', '@picovoice/web-voice-processor']
        }
      }
    },
    // Increase chunk size warning limit (gzipped sizes are what matter; 256.47 KB is acceptable)
    chunkSizeWarningLimit: 1000
  }
});

