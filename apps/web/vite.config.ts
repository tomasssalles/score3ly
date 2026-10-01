import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to `wrangler dev` (see apps/worker).
    proxy: { "/api": "http://localhost:8787" },
  },
});
