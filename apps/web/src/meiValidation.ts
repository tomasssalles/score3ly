// Checking an MEI file in the browser (DESIGN.md §6, `final_touches`): in a Web Worker (meiCheckWorker.ts), which
// compiles the MEI 5.1 schema once, as soon as it starts. The editor starts it when it opens, so the first Apply
// doesn't wait for the schema. Nothing is sent before the worker says it listens.

import type { MeiProblem } from "./meiChecks";
import type { CheckRequest, CheckResponse } from "./meiCheckWorker";

let worker: Promise<Worker> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (problems: MeiProblem[]) => void; reject: (error: Error) => void }>();

function getWorker(): Promise<Worker> {
  worker ??= new Promise((listening) => {
    const created = new Worker(new URL("./meiCheckWorker.ts", import.meta.url), { type: "module" });
    created.addEventListener("message", (event: MessageEvent<CheckResponse>) => {
      if ("listening" in event.data) return listening(created);
      const waiting = pending.get(event.data.id);
      if (!waiting) return;
      pending.delete(event.data.id);
      if ("error" in event.data) waiting.reject(new Error(event.data.error));
      else waiting.resolve(event.data.problems);
    });
  });
  return worker;
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
