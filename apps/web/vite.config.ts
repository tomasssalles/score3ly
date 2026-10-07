import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { pdfjsAssets } from "./pdfjsAssets.ts";

// The app's version (root package.json) and the commit it was built from, shown on the About page.
// The commit is null where git isn't available; "dirty" means the build included uncommitted changes.
const version: string = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const commit = git("rev-parse --short HEAD");
const dirty = commit !== null && git("status --porcelain") !== "";

export default defineConfig({
  plugins: [react(), pdfjsAssets()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_DIRTY__: JSON.stringify(dirty),
  },
  server: {
    // Forward API calls to `wrangler dev` (see apps/worker).
    proxy: { "/api": "http://localhost:8787" },
  },
});
