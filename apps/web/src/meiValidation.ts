// Checking an MEI file in the browser (docs/stages/engrave.md): in a Web Worker (meiCheckWorker.ts), which
// compiles the MEI 5.1 schema once, as soon as it starts. The editor starts it when it opens, so the first Apply
// doesn't wait for the schema. Nothing is sent before the worker says it listens.

import type { MeiProblem } from "./meiChecks";
import type { CheckRequest, CheckResponse } from "./meiCheckWorker";

let worker: Promise<Worker> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (problems: MeiProblem[]) => void; reject: (error: Error) => void }>();

// How long the worker may take to say it listens (it loads libxml2's WASM and the module first): a worker whose
// script couldn't be loaded may never say anything, nor fail.
export const HANDSHAKE_MS = 60 * 1000;

// A worker that fails, or never starts, rejects every check waiting for it and is dropped: the next check starts
// another (until B20's shared worker client, review/plan.md batch 23).
function getWorker(): Promise<Worker> {
  if (worker) return worker;
  let started = false;
  const made: Promise<Worker> = new Promise((listening, failed) => {
    const created = new Worker(new URL("./meiCheckWorker.ts", import.meta.url), { type: "module" });
    const fail = (error: Error) => {
      clearTimeout(timer);
      created.terminate();
      for (const waiting of pending.values()) waiting.reject(error);
      pending.clear();
      if (worker === made) worker = null;
      failed(error);
    };
    const timer = setTimeout(() => fail(new Error("The MEI checks couldn't start: the check worker didn't answer.")), HANDSHAKE_MS);
    created.addEventListener("message", (event: MessageEvent<CheckResponse>) => {
      if ("listening" in event.data) {
        started = true;
        clearTimeout(timer);
        return listening(created);
      }
      const waiting = pending.get(event.data.id);
      if (!waiting) return;
      pending.delete(event.data.id);
      if ("error" in event.data) waiting.reject(new Error(event.data.error));
      else waiting.resolve(event.data.problems);
    });
    created.addEventListener("error", (event: ErrorEvent) => {
      const detail = event.message ? `: ${event.message}` : ".";
      fail(new Error(started ? `The MEI checks failed${detail}` : `The MEI checks couldn't start${detail}`));
    });
  });
  made.catch(() => {}); // a failure reaches the checks that wait; prepareMeiChecks doesn't
  worker = made;
  return made;
}

export async function checkMeiText(text: string): Promise<MeiProblem[]> {
  const ready = await getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ready.postMessage({ id, text } satisfies CheckRequest);
  });
}

// Starts the worker, which compiles the schema ahead of the first check.
export function prepareMeiChecks(): void {
  void getWorker();
}
