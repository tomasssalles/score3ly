// The checks of an MEI file edited by hand, in a Web Worker (meiValidation.ts): the schema is compiled as soon as the
// worker starts, and kept, so checks are quick. libxml2 is loaded with a top-level await, and a message that arrives
// before the module has run can be lost: the worker says when it listens, and only then is it sent anything.

import schemaUrl from "../../../packages/notation/schemas/mei-all.rng?url";
import { checkMei, type MeiProblem } from "./meiChecks";
import { meiValidator } from "./meiSchema";

export type CheckRequest = { id: number; text: string };
export type CheckResponse = { listening: true } | { id: number; problems: MeiProblem[] } | { id: number; error: string };

let validator: Promise<(text: string) => MeiProblem[]> | null = null;

function ready() {
  validator ??= fetch(schemaUrl)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`the MEI schema couldn't be loaded (${r.status})`))))
    .then(meiValidator)
    .catch((err) => {
      validator = null;
      throw err;
    });
  return validator;
}

self.addEventListener("message", async (event: MessageEvent<CheckRequest>) => {
  const { id, text } = event.data;
  try {
    const validate = await ready();
    const problems = await checkMei(text, async (t) => validate(t));
    self.postMessage({ id, problems } satisfies CheckResponse);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies CheckResponse);
  }
});

ready().catch(() => {}); // a failure shows with the first check
self.postMessage({ listening: true } satisfies CheckResponse);
