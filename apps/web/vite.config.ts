import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { pdfjsAssets } from "./pdfjsAssets.ts";

export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  server: {
    // Forward API calls to `wrangler dev` (see apps/worker).
    proxy: { "/api": "http://localhost:8787" },
  },
});
