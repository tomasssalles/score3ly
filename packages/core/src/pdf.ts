// Drawing a PDF's page in a browser (docs/project-view.md), for the web app's PDF view and the evaluation viewer. pdf.js
// itself stays with each app, which picks its build (the web app the legacy one, for older phones); this takes the
// part of a loaded document it uses.

// `V`: pdf.js's viewport, which `render` takes back as it was given.
export type PdfPageLike<V extends { width: number; height: number }> = {
  getViewport(options: { scale: number }): V;
  render(options: { canvas: HTMLCanvasElement; viewport: V }): { promise: Promise<unknown> };
};

export type PdfDocumentLike<V extends { width: number; height: number }> = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike<V>>;
};

// Draws a page on a new canvas, `width` CSS pixels wide. It is drawn in device pixels, so it stays sharp on
// high-DPI screens; the caller's CSS sets the size it is shown at.
export async function drawPage<V extends { width: number; height: number }>(
  doc: PdfDocumentLike<V>,
  pageNumber: number,
  width: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const scale = (width / page.getViewport({ scale: 1 }).width) * window.devicePixelRatio;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

// Where an app serves the data files pdf.js loads at runtime (the pdfjsAssets plugin), to pass to getDocument.
export const PDFJS_DATA = {
  wasmUrl: "/pdfjs/wasm/",
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  iccUrl: "/pdfjs/iccs/",
};
