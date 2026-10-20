import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    // The backend listens on 127.0.0.1:3000 (src/main.ts). Proxying /api keeps
    // the browser on one origin, so the backend needs no CORS setup.
    // The object form keeps the browser's Host header (the string form rewrites it
    // to the backend's), so the backend builds GitHub's callback URL on this origin,
    // where the sign-in state cookie lives.
    proxy: {
      "/api": { target: "http://127.0.0.1:3000", xfwd: true },
    },
  },
});
