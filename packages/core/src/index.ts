// What the apps share (docs/overview.md §3): code and types needed by more than one of the web app, the Worker, the desktop
// app and the evaluation tools. Runs in browsers, Workers and Node alike; the parts that don't are separate entry
// points: `@score3ly/core/pdf` (browsers) and `@score3ly/core/pdfjs-assets` (Vite, in Node).

export { canonicalJson, isSha256Hex, keyOf, modelKeyOf, normalized, sha256Hex } from "./keys.ts";
export type { ListedProject, PipelinePosition, Project, RunMode } from "./project.ts";
export { formatPages, parsePages, selectPages } from "./pageSelection.ts";
export { readSse } from "./sse.ts";
export type { CallEvent } from "./callEvents.ts";
export { sameValuesMessage } from "./modelConfigs.ts";
export { fromBase64, toBase64, toBase64Url } from "./base64.ts";
export { firstFreeName, MAX_NAME_LENGTH, nameTooLong } from "./names.ts";
