// Builds the desktop app into dist/ (docs/desktop.md): the main process and the server alone, each
// one file with the Worker's code and its dependencies (Electron itself stays outside), the web app's build, and the
// Worker's migration files, applied at startup. Run after the web app's build (`npm run build` does both).

import { build } from "esbuild";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dirname;
const dist = join(here, "dist");
const web = join(here, "../web/dist");
if (!existsSync(join(web, "index.html"))) throw new Error("build the web app first: npm run build -w apps/web");

rmSync(dist, { recursive: true, force: true });
await build({
  entryPoints: { main: join(here, "src/main.ts"), server: join(here, "src/server.ts") },
  outdir: dist,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["electron"],
  // Some dependencies are CommonJS and call require(); an ES module needs one made for it.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: "warning",
});
cpSync(web, join(dist, "web"), { recursive: true });
cpSync(join(here, "../worker/migrations"), join(dist, "migrations"), { recursive: true });
console.log("Built apps/desktop/dist");
