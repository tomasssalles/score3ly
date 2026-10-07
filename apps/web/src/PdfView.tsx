// Shows all pages of a PDF one below the other, scaled to the view's width, in a scrollable view.
// When the width changes, the pages are redrawn at the new width. Key the view by URL, so another PDF
// gets a new view. (Simplified from apps/eval/src/PdfPane.tsx.)

import { type RefObject, useEffect, useRef, useState } from "react";
// The legacy build: the modern one needs very recent browser features (e.g. Map.getOrInsertComputed)
// that many phones don't have yet.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Folders provided by the pdfjsAssets plugin (apps/web/pdfjsAssets.ts).
const PDFJS_DATA = {
  wasmUrl: "/pdfjs/wasm/",
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  iccUrl: "/pdfjs/iccs/",
};

const RESIZE_DELAY = 150; // ms to wait for resizing to settle before redrawing

export function PdfView({ url }: { url: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy>();
  const [drawn, setDrawn] = useState(false);
  const [error, setError] = useState<string>();
  const width = useSettledWidth(pagesRef, RESIZE_DELAY);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjs.PDFDocumentLoadingTask | undefined;
    async function load() {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (cancelled) return;
      loadingTask = pdfjs.getDocument({ data: bytes, ...PDFJS_DATA });
      const loaded = await loadingTask.promise;
      if (!cancelled) setDoc(loaded);
    }
    load().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (doc === undefined || width === 0) return;
    let cancelled = false;
    // Draw off-screen, then swap all pages in at once, so the view never shows a half-drawn state.
    drawPages(doc, width, () => cancelled)
      .then((pages) => {
        if (!cancelled) {
          pagesRef.current!.replaceChildren(...pages);
          setDrawn(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [doc, width]);

  return (
    <div className="pdf-view" ref={scrollRef}>
      {error ? (
        <p className="pdf-status">The PDF could not be shown: {error}</p>
      ) : (
        !drawn && <p className="pdf-status">Loading the PDF…</p>
      )}
      <div className="pdf-pages" ref={pagesRef} />
    </div>
  );
}

async function drawPages(
  doc: pdfjs.PDFDocumentProxy,
  width: number,
  isCancelled: () => boolean,
): Promise<HTMLCanvasElement[]> {
  const pages: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages && !isCancelled(); pageNumber++) {
    const page = await doc.getPage(pageNumber);
    // Draw at the view's width in device pixels, so pages stay sharp on high-DPI screens.
    const scale = (width / page.getViewport({ scale: 1 }).width) * window.devicePixelRatio;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    // Until the next redraw, the browser scales the drawing to the view's current width.
    canvas.className = "pdf-page";
    canvas.setAttribute("aria-label", `Page ${pageNumber}`);
    await page.render({ canvas, viewport }).promise;
    pages.push(canvas);
  }
  return pages;
}

// The element's content width in pixels, updated once it has stopped changing for `delay` ms.
// Width 0 (the view is hidden) is ignored, so hiding and showing the view doesn't cause a redraw.
function useSettledWidth(ref: RefObject<HTMLElement | null>, delay: number): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let timer: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const newWidth = Math.round(entry.contentRect.width);
      window.clearTimeout(timer);
      if (newWidth === 0) return;
      timer = window.setTimeout(() => setWidth(newWidth), delay);
    });
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref, delay]);
  return width;
}
