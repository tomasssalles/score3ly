// `engrave`'s engraving (DESIGN.md §6, `engrave`): Verovio's pages, made when they are shown or downloaded, never
// stored. With the original's breaks, Verovio gets a copy of the MEI in which a measure split by a system break is
// divided there (it doesn't break inside a measure); with its own breaks, the stored file as it is. The PDF is made
// from the pages in the browser (jsPDF and svg2pdf.js, loaded only when a PDF is made).

import { buildMei, serialize } from "@score3ly/notation";
import { fetchJsonContent, fetchTextContent } from "./api";
import { loadScore, PAGE_SIZES, type EngraveConfig } from "./engrave";
import type { Artifact } from "./pipeline";
import { renderPages } from "./rendering";

type Engraving = NonNullable<Artifact["engraving"]>;

// Verovio's options for a page of the given size (its units are tenths of a millimetre).
export function pageOptions(config: EngraveConfig): Record<string, unknown> {
  const size = PAGE_SIZES[config.pageSize];
  return {
    breaks: config.breaks === "original" ? "encoded" : "auto",
    pageWidth: Math.round(size.width * 10),
    pageHeight: Math.round(size.height * 10),
    scale: 40,
    footer: "none",
    svgViewBox: true,
  };
}

async function meiToEngrave(engraving: Engraving): Promise<string> {
  if (engraving.config.breaks === "auto") return fetchTextContent(engraving.meiSha256);
  const { score, metadata } = await loadScore(engraving.sources, fetchJsonContent);
  return serialize(buildMei(score, { metadata, divideAtSystemBreaks: true }));
}

export async function engravedPages(engraving: Engraving): Promise<string[]> {
  return renderPages(await meiToEngrave(engraving), pageOptions(engraving.config));
}

// The pages as a PDF of the config's page size.
export async function engravedPdf(engraving: Engraving): Promise<Blob> {
  const svgs = await engravedPages(engraving);
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const { width, height } = PAGE_SIZES[engraving.config.pageSize];
  const pdf = new jsPDF({ unit: "mm", format: [width, height], orientation: "portrait" });
  // svg2pdf reads computed styles, so each page is put in the document while it is converted, out of sight.
  const holder = document.createElement("div");
  holder.style.cssText = "position: fixed; left: -10000px; top: 0; width: 1000px; visibility: hidden";
  document.body.append(holder);
  try {
    for (const [i, svg] of svgs.entries()) {
      if (i > 0) pdf.addPage([width, height], "portrait");
      holder.innerHTML = svg;
      const root = flattened(holder.querySelector("svg")!, width, height);
      await svg2pdf(root, pdf, { x: 0, y: 0, width, height });
    }
  } finally {
    holder.remove();
  }
  return pdf.output("blob");
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
