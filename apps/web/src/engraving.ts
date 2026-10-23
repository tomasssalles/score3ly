// `engrave`'s engraving (DESIGN.md §6, `engrave`): Verovio's pages of the stored MEI, with its own breaks, made when
// they are shown or downloaded, never stored. The PDF is made from the pages in the browser (jsPDF and svg2pdf.js,
// loaded only when a PDF is made).

import { fetchTextContent } from "./api";
import { PAGE_SIZES, type EngraveConfig } from "./engrave";
import type { Artifact } from "./pipeline";
import { renderPages } from "./rendering";

type Engraving = NonNullable<Artifact["engraving"]>;

// Verovio's options for a page of the given size (its units are tenths of a millimetre).
export function pageOptions(config: EngraveConfig): Record<string, unknown> {
  const size = PAGE_SIZES[config.pageSize];
  return {
    breaks: "auto",
    pageWidth: Math.round(size.width * 10),
    pageHeight: Math.round(size.height * 10),
    scale: 40,
    footer: "none",
    svgViewBox: true,
  };
}

export async function engravedPages(engraving: Engraving): Promise<string[]> {
  return renderPages(await fetchTextContent(engraving.meiSha256), pageOptions(engraving.config));
}

// The pages as a PDF of the config's page size.
export async function engravedPdf(engraving: Engraving): Promise<Blob> {
  return pdfOfPages(await engravedPages(engraving), engraving.config.pageSize);
}

// Verovio's pages (SVG) as a PDF of that page size.
export async function pdfOfPages(svgs: string[], pageSize: EngraveConfig["pageSize"]): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }, { METRONOME_FONT }] = await Promise.all([import("jspdf"), import("svg2pdf.js"), import("./metronomeFont")]);
  const { width, height } = PAGE_SIZES[pageSize];
  const pdf = new jsPDF({ unit: "mm", format: [width, height], orientation: "portrait" });
  // Verovio draws a tempo mark's note in its music font, which it embeds in the SVG where the PDF can't use it: the
  // metronome glyphs are added under the same name (scripts/metronomeFont.ts).
  // Under every style svg2pdf.js may ask for (a tempo mark's text is bold): the glyphs are the same.
  pdf.addFileToVFS("Leipzig.ttf", METRONOME_FONT);
  for (const style of ["normal", "bold", "italic", "bolditalic"]) pdf.addFont("Leipzig.ttf", "Leipzig", style);
  // svg2pdf reads computed styles, so each page is put in the document while it is converted, out of sight.
  const holder = document.createElement("div");
  holder.style.cssText = "position: fixed; left: -10000px; top: 0; width: 1000px; visibility: hidden";
  document.body.append(holder);
  try {
    for (const [i, svg] of svgs.entries()) {
      if (i > 0) pdf.addPage([width, height], "portrait");
      holder.innerHTML = svg;
      await pinTextAfterGlyphs(holder);
      const root = flattened(holder.querySelector("svg")!, width, height);
      await svg2pdf(root, pdf, { x: 0, y: 0, width, height });
    }
  } finally {
    holder.remove();
  }
  return pdf.output("blob");
}

// svg2pdf.js lays out the text after a music glyph in a line of text (a tempo mark's note) as if the glyph were in the
// text's font, which leaves a gap: each piece of text after one is pinned where the browser draws it.
async function pinTextAfterGlyphs(holder: HTMLElement) {
  if (!holder.querySelector('tspan[font-family="Leipzig"]')) return;
  // The browser measures with the music font only once it has loaded it (Verovio embeds it in the SVG).
  await document.fonts.load("100px Leipzig", "\uE1D5").catch(() => {});
  for (const text of holder.querySelectorAll("text")) {
    const pieces = [...text.querySelectorAll("tspan")].filter((t) => t.childElementCount === 0 && t.textContent);
    const first = pieces.findIndex((t) => t.getAttribute("font-family") === "Leipzig");
    if (first < 0) continue;
    for (const piece of pieces.slice(first + 1)) {
      const at = piece.getStartPositionOfChar(0);
      piece.setAttribute("x", String(at.x));
      piece.setAttribute("y", String(at.y));
    }
  }
}

// Verovio draws a page in an SVG nested in the page's own (class "definition-scale", with its own view box), which
// svg2pdf.js doesn't scale: the nested one becomes a group scaled to the page's view box, and the page gets its size.
function flattened(root: SVGSVGElement, width: number, height: number): SVGSVGElement {
  const viewBox = (e: Element) => (e.getAttribute("viewBox") ?? "0 0 1 1").split(/[\s,]+/).map(Number);
  const inner = root.querySelector("svg.definition-scale");
  if (inner) {
    const [, , outerWidth, outerHeight] = viewBox(root);
    const [, , innerWidth, innerHeight] = viewBox(inner);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("transform", `scale(${outerWidth / innerWidth} ${outerHeight / innerHeight})`);
    for (const name of ["color", "font-family"]) {
      const value = inner.getAttribute(name);
      if (value) group.setAttribute(name, value);
    }
    group.append(...inner.childNodes);
    inner.replaceWith(group);
  }
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  return root;
}

export async function meiFile(engraving: Engraving): Promise<Blob> {
  return new Blob([await fetchTextContent(engraving.meiSha256)], { type: "application/xml" });
}

// Hands a file to the browser to save.
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
