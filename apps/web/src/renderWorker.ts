// Renders MEI with Verovio (docs/overview.md §9), in a Web Worker: Verovio is a few MB of WASM, loaded here only when the
// first rendering is asked for, and rendering a long system takes a moment the page shouldn't wait for.

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

// One page (a system alone), or every page (an engraving).
export type RenderRequest = { id: number; mei: string; options: Record<string, unknown>; allPages?: boolean };
export type RenderResponse = { id: number; svgs: string[] } | { id: number; error: string };

let toolkit: Promise<VerovioToolkit> | null = null;

self.addEventListener("message", async (event: MessageEvent<RenderRequest>) => {
  const { id, mei, options } = event.data;
  const post = (response: RenderResponse) => self.postMessage(response);
  try {
    toolkit ??= createVerovioModule().then((module) => new VerovioToolkit(module));
    const tk = await toolkit;
    tk.setOptions(options);
    if (!tk.loadData(mei)) throw new Error(tk.getLog().trim() || "Verovio couldn't read the MEI.");
    const count = event.data.allPages ? tk.getPageCount() : 1;
    post({ id, svgs: Array.from({ length: count }, (_, i) => tk.renderToSVG(i + 1)) });
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) });
  }
});
