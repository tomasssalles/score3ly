// What the rendering worker does with Verovio (renderWorker.ts), apart from the worker, so that Node's tests run it too.

import type { VerovioToolkit } from "verovio/esm";

// The SVG of the first page (a system alone), or of every page (an engraving). Verovio keeps options from one call to
// the next, so each rendering starts from its defaults: otherwise an engraving made after a system kept the system's
// options (no title, a page shrunk to the music).
export function renderWith(tk: VerovioToolkit, mei: string, options: Record<string, unknown>, allPages: boolean): string[] {
  tk.resetOptions();
  tk.setOptions(options);
  if (!tk.loadData(mei)) throw new Error(tk.getLog().trim() || "Verovio couldn't read the MEI.");
  const count = allPages ? tk.getPageCount() : 1;
  return Array.from({ length: count }, (_, i) => tk.renderToSVG(i + 1));
}
