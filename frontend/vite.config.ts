import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const backendHost = process.env.BACKEND_HOST || "0.0.0.0";
const backendPort = process.env.BACKEND_PORT || "4000";
const backendUrl = `http://${backendHost}:${backendPort}`;

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        logLevel: 'error',
        onError: (err, _req, _res) => {
          console.log('[Proxy] Backend not ready yet, retrying on next request...');
        }
      },
      "/super-admin": {
        target: backendUrl,
        changeOrigin: true,
      },
      "/c-panel.html": {
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
          'vendor-axios': ['axios']
        }
      }
    },
    // Increase chunk size warning limit (gzipped sizes are what matter; 256.47 KB is acceptable)
    chunkSizeWarningLimit: 1000
  }
});

