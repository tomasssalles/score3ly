// The checks of an MEI file edited by hand, in a Web Worker (meiValidation.ts): the schema is compiled as soon as the
// worker starts, and kept, so checks are quick. libxml2 is loaded with a top-level await: `serve` says when the worker
// listens, once the module has run, and only then is it sent anything (workerClient.ts).

import schemaUrl from "../../../packages/notation/schemas/mei-all.rng?url";
import { checkMei, type MeiProblem } from "./meiChecks";
import { keptUntilFailure } from "./keptUntilFailure";
import { meiValidator } from "./meiSchema";
import { serve } from "./workerClient.ts";

// A check: the MEI's text in, its problems out.
export type MeiCheckCalls = { check: { request: string; response: MeiProblem[] } };

// Compiled once; a failure (the schema not fetched) is tried again at the next check.
const ready = keptUntilFailure(() =>
  fetch(schemaUrl)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`the MEI schema couldn't be loaded (${r.status})`))))
    .then(meiValidator),
);

ready().catch(() => {}); // a failure shows with the first check
serve<MeiCheckCalls>({
  check: async (text) => {
    const validate = await ready();
    return checkMei(text, async (t) => validate(t));
  },
});
