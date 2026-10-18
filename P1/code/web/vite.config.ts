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
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
