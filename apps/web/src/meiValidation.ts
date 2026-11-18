// Checking an MEI file in the browser (docs/stages/engrave.md): in a Web Worker (meiCheckWorker.ts), which
// compiles the MEI 5.1 schema once, as soon as it starts. The editor starts it when it opens, so the first Apply
// doesn't wait for the schema. A worker that fails, or never starts, fails every check waiting for it, and the next
// check starts another (workerClient.ts).

import type { MeiProblem } from "./meiChecks";
import type { MeiCheckCalls } from "./meiCheckWorker";
import { workerClient } from "./workerClient.ts";

// How long the worker may take to say it listens (it loads libxml2's WASM and the module first): a worker whose
// script couldn't be loaded may never say anything, nor fail.
export const HANDSHAKE_MS = 60 * 1000;

const checks = workerClient<MeiCheckCalls>(() => new Worker(new URL("./meiCheckWorker.ts", import.meta.url), { type: "module" }), {
  failure: (detail, started) => `${started ? "The MEI checks failed" : "The MEI checks couldn't start"}${detail ? `: ${detail}` : "."}`,
  handshakeMs: HANDSHAKE_MS,
  handshakeFailure: "The MEI checks couldn't start: the check worker didn't answer.",
});

export function checkMeiText(text: string): Promise<MeiProblem[]> {
  return checks.ask("check", text);
}

// Starts the worker, which compiles the schema ahead of the first check.
export function prepareMeiChecks(): void {
  checks.start();
}
