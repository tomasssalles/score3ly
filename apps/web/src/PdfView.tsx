// Shows all pages of a PDF one below the other, scaled to the view's width, in a scrollable view.
// When the width changes, the pages are redrawn at the new width. Key the view by URL, so another PDF
// gets a new view. (Simplified from apps/eval/src/PdfPane.tsx.)

import { type RefObject, useEffect, useRef, useState } from "react";
import { drawPage, type PdfDocument, usePdf } from "./pdf";
import { errorText } from "@score3ly/core";

const RESIZE_DELAY = 150; // ms to wait for resizing to settle before redrawing

export function PdfView({ url }: { url: string }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const { doc, error: loadError } = usePdf(url);
  const [drawn, setDrawn] = useState(false);
  const [drawError, setDrawError] = useState<string>();
  const error = loadError ?? drawError;
  const width = useSettledWidth(pagesRef, RESIZE_DELAY);

  useEffect(() => {
    if (doc === undefined || width === 0) return;
    let cancelled = false;
    // Draw off-screen, then swap all pages in at once, so the view never shows a half-drawn state.
    // The canvases replaced, or drawn for nothing, are released at once rather than when they are collected: a page
    // drawn at a phone's device pixels takes several MB, and mobile Safari limits the canvases' memory (docs/images.md §8.5).
    drawPages(doc, width, () => cancelled)
      .then((pages) => {
        if (cancelled) return release(pages);
        const shown = [...pagesRef.current!.children];
        pagesRef.current!.replaceChildren(...pages);
        release(shown);
        setDrawn(true);
      })
      .catch((e) => {
        if (!cancelled) setDrawError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [doc, width]);

  useEffect(() => {
    const pages = pagesRef.current!;
    return () => release([...pages.children]);
  }, []);

  return (
    <div className="pdf-view">
      {error ? (
        <p className="pdf-status pdf-error error-text">The PDF could not be shown: {error}</p>
      ) : (
        !drawn && <p className="pdf-status">Loading the PDF…</p>
      )}
      <div className="pdf-pages" ref={pagesRef} />
    </div>
  );
}

function release(canvases: Element[]) {
  for (const canvas of canvases) if (canvas instanceof HTMLCanvasElement) canvas.width = canvas.height = 0;
}

async function drawPages(doc: PdfDocument, width: number, isCancelled: () => boolean): Promise<HTMLCanvasElement[]> {
  const pages: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages && !isCancelled(); pageNumber++) {
    // Until the next redraw, the browser scales the drawing to the view's current width.
    const canvas = await drawPage(doc, pageNumber, width);
    canvas.className = "pdf-page";
    canvas.setAttribute("aria-label", `Page ${pageNumber}`);
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
