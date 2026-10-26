// What the apps share (DESIGN.md §3): code and types needed by more than one of the web app, the Worker, the desktop
// app and the evaluation tools. Runs in browsers, Workers and Node alike; the parts that don't are separate entry
// points: `@score3ly/core/pdf` (browsers) and `@score3ly/core/pdfjs-assets` (Vite, in Node).

export { canonicalJson, keyOf, sha256Hex } from "./keys.ts";
export type { Project, RunMode } from "./project.ts";
