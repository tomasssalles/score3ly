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

// The data files pdf.js loads at runtime: the option of getDocument that names each folder, and the folder, served under
// /pdfjs/<folder>/ by the pdfjsAssets plugin (./pdfjsAssets.ts). Without the wasm decoders, for example, pages with
// JBIG2 or JPEG 2000 scans render blank.
export const PDFJS_FOLDERS = { wasmUrl: "wasm", cMapUrl: "cmaps", standardFontDataUrl: "standard_fonts", iccUrl: "iccs" } as const;

type PdfjsData = { [option in keyof typeof PDFJS_FOLDERS]: string };

// Where an app serves them, to pass to getDocument.
export const PDFJS_DATA = Object.fromEntries(
  Object.entries(PDFJS_FOLDERS).map(([option, folder]) => [option, `/pdfjs/${folder}/`]),
) as PdfjsData;

// What loadPdf needs of pdf.js's getDocument (each app passes its own build's).
export type PdfLoadingTask<D> = { promise: Promise<D>; destroy(): Promise<void> | void };

// Opens a PDF's bytes with pdf.js, with its data files; the document is destroyed (its memory freed) once `signal`
// aborts, as when the view showing it goes.
export function loadPdf<D>(data: Uint8Array, getDocument: (source: { data: Uint8Array } & PdfjsData) => PdfLoadingTask<D>, signal: AbortSignal): Promise<D> {
  const task = getDocument({ data, ...PDFJS_DATA });
  if (signal.aborted) void task.destroy();
  else signal.addEventListener("abort", () => void task.destroy(), { once: true });
  return task.promise;
}
