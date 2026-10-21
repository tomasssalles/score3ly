// Renders MEI with Verovio (DESIGN.md §9), in a Web Worker: Verovio is a few MB of WASM, loaded here only when the
// first rendering is asked for, and rendering a long system takes a moment the page shouldn't wait for.

import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

export type RenderRequest = { id: number; mei: string; options: Record<string, unknown> };
export type RenderResponse = { id: number; svg: string } | { id: number; error: string };

let toolkit: Promise<VerovioToolkit> | null = null;

self.addEventListener("message", async (event: MessageEvent<RenderRequest>) => {
  const { id, mei, options } = event.data;
  const post = (response: RenderResponse) => self.postMessage(response);
  try {
    toolkit ??= createVerovioModule().then((module) => new VerovioToolkit(module));
    const tk = await toolkit;
    tk.setOptions(options);
    if (!tk.loadData(mei)) throw new Error(tk.getLog().trim() || "Verovio couldn't read the MEI.");
    post({ id, svg: tk.renderToSVG(1) });
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) });
  }
});
