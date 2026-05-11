import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Proxy /api to the Express backend in development.
    // This keeps cookies on the same origin (localhost:5173) and avoids CORS preflight.
    proxy: {
      "/api": {
        target: `http://${process.env.API_HOST || "localhost"}:3001`,
        changeOrigin: true,
      },
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.js",
  },
});
