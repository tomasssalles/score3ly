import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { pdfjsAssets } from "./src/pdfjsAssets.ts";
import { testsetServer } from "./src/testsetServer.ts";

export default defineConfig({
  plugins: [react(), testsetServer(), pdfjsAssets()],
  server: { port: 5174 },
});
