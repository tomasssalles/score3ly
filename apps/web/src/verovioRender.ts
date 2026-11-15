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

// A system as wide as `pageWidth` (Verovio's units, margins included; docs/stages/music.md, "The Transcription"): on a
// page of that width, justified to fill it (`minLastJustification: 0` justifies the one system, which Verovio otherwise
// leaves as it is when it is the last and less than 80% full). Only a system wider than the page, which Verovio breaks
// into several systems there, is rendered again, at its own width (`breaks: "none"`).
export function renderFitted(tk: VerovioToolkit, mei: string, options: Record<string, unknown>, pageWidth: number): string {
  const [fitted] = renderWith(tk, mei, { ...options, breaks: "auto", adjustPageWidth: false, pageWidth, minLastJustification: 0 }, false);
  if (tk.getPageCount() === 1 && (fitted.match(/class="system"/g) ?? []).length === 1) return fitted;
  return renderWith(tk, mei, options, false)[0];
}

export function viewBoxWidth(svg: string): number | null {
  const m = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) [\d.]+"/.exec(svg.slice(0, 1000));
  return m ? Number(m[1]) : null;
}
