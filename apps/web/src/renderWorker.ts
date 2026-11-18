// Renders MEI with Verovio (docs/overview.md §9), in a Web Worker: Verovio is a few MB of WASM, loaded here only when the
// first rendering is asked for, and rendering a long system takes a moment the page shouldn't wait for.

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { keptUntilFailure } from "./keptUntilFailure";
import { renderFitted, renderWith } from "./verovioRender";
import { serve } from "./workerClient.ts";

// One page (a system alone, as wide as `pageWidth` where it is given: renderFitted), or every page (an engraving).
export type RenderRequest = { mei: string; options: Record<string, unknown>; allPages: boolean; pageWidth?: number };
export type RenderCalls = { render: { request: RenderRequest; response: string[] } };

// Loaded at the first rendering; a failed load (the WASM not fetched) is tried again at the next one. A Verovio that
// aborts later is broken for good: `serve` answers its error as fatal, and the page replaces this worker.
const toolkit = keptUntilFailure(() => createVerovioModule().then((module) => new VerovioToolkit(module)));

serve<RenderCalls>({
  render: async ({ mei, options, allPages, pageWidth }) => {
    const tk = await toolkit();
    return pageWidth !== undefined ? [renderFitted(tk, mei, options, pageWidth)] : renderWith(tk, mei, options, allPages);
  },
});
