// Shows all pages of a PDF one below the other, scaled to the pane's width, in a scrollable pane,
// with highlighter strokes on top.
// When the pane's width changes, the pages are redrawn at the new width. Whenever the pages change
// size, the spot at the top edge stays in place. The caller should key the pane by URL, so another
// PDF gets a new pane.

import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { STROKE_WIDTH, createDrawingLayer, paintLine, paintStrokes, pointOn } from "./highlighter.ts";
import type { Point, Stroke } from "./marks.ts";
import { type PageBox, type ScrollAnchor, anchorAt, scrollTopFor } from "./scrollAnchor.ts";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Folders served by the pdfjsAssets plugin.
const PDFJS_DATA = {
  wasmUrl: "/pdfjs/wasm/",
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  iccUrl: "/pdfjs/iccs/",
};

const PAGE_GAP = 8; // pixels between pages
const RESIZE_DELAY = 150; // ms to wait for resizing to settle before redrawing

type Props = {
  url: string;
  strokes: Stroke[] | undefined; // undefined while they're loading; no drawing until then
  highlightColor: string | null; // null in reading mode
  onStroke: (stroke: Stroke) => void;
};

type StrokeInProgress = { layer: HTMLCanvasElement; page: number; color: string; points: Point[] };

export function PdfPane({ url, strokes, highlightColor, onStroke }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjs.PDFDocumentProxy>();
  const [pdfSha256, setPdfSha256] = useState<string>();
  const [pagesDrawn, setPagesDrawn] = useState(0); // counts redraws, to repaint strokes after each
  const [error, setError] = useState<string>();
  const strokeInProgress = useRef<StrokeInProgress | null>(null);
  const width = useSettledWidth(scrollRef, RESIZE_DELAY);
  useKeepTopInPlace(scrollRef, pagesRef);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: pdfjs.PDFDocumentLoadingTask | undefined;
    async function load() {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Hash before pdf.js takes over the bytes.
      const hash = await sha256Hex(bytes);
      if (cancelled) {
        return;
      }
      loadingTask = pdfjs.getDocument({ data: bytes, ...PDFJS_DATA });
      const loaded = await loadingTask.promise;
      if (!cancelled) {
        setPdfSha256(hash);
        setDoc(loaded);
      }
    }
    load().catch((e) => {
      if (!cancelled) {
        setError(String(e));
      }
    });
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (doc === undefined || width === 0) {
      return;
    }
    let cancelled = false;
    // Draw off-screen, then swap all pages in at once, so the view never shows a half-drawn state.
    drawPages(doc, width, () => cancelled)
      .then((pages) => {
        if (!cancelled) {
          pagesRef.current!.replaceChildren(...pages);
          setPagesDrawn((n) => n + 1);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doc, width]);

  useEffect(() => {
    for (const layer of drawingLayers(pagesRef.current!)) {
      const page = Number(layer.parentElement!.dataset.page);
      paintStrokes(layer, (strokes ?? []).filter((s) => s.page === page));
    }
  }, [strokes, pagesDrawn]);

  const canDraw = highlightColor !== null && strokes !== undefined && pdfSha256 !== undefined;

  function onPointerDown(event: PointerEvent) {
    const layer = event.target as HTMLElement;
    if (!canDraw || !(layer instanceof HTMLCanvasElement) || !layer.dataset.drawingLayer) {
      return;
    }
    event.preventDefault();
    layer.setPointerCapture(event.pointerId);
    const point = pointOn(layer, event.clientX, event.clientY);
    const page = Number(layer.parentElement!.dataset.page);
    strokeInProgress.current = { layer, page, color: highlightColor, points: [point] };
    paintLine(layer, highlightColor, STROKE_WIDTH, [point]);
  }

  function onPointerMove(event: PointerEvent) {
    const stroke = strokeInProgress.current;
    if (stroke === null) {
      return;
    }
    const point = pointOn(stroke.layer, event.clientX, event.clientY);
    paintLine(stroke.layer, stroke.color, STROKE_WIDTH, [stroke.points.at(-1)!, point]);
    stroke.points.push(point);
  }

  function onPointerUp() {
    const stroke = strokeInProgress.current;
    if (stroke === null) {
      return;
    }
    strokeInProgress.current = null;
    onStroke({
      page: stroke.page,
      color: stroke.color,
      width: STROKE_WIDTH,
      pdfSha256: pdfSha256!,
      points: stroke.points,
    });
  }

  const outdated = (strokes ?? []).filter((s) => pdfSha256 && s.pdfSha256 !== pdfSha256).length;

  return (
    <div
      ref={scrollRef}
      style={{
        height: "100%",
        overflowY: "auto",
        scrollbarGutter: "stable",
        position: "relative", // so the pages' offsetTop is measured within this pane
        background: "#888",
      }}
    >
      {error && <p>Could not show {url}: {error}</p>}
      {outdated > 0 && (
        <p style={{ background: "#fdd", margin: 0, padding: 4 }}>
          {outdated} highlighter stroke(s) were drawn on a different version of this PDF and may be
          misplaced.
        </p>
      )}
      <div
        ref={pagesRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: canDraw ? "crosshair" : "default", touchAction: canDraw ? "none" : "auto" }}
      />
    </div>
  );
}

// Each page is a wrapper holding the drawn page and its drawing layer.
async function drawPages(
  doc: pdfjs.PDFDocumentProxy,
  width: number,
  isCancelled: () => boolean,
): Promise<HTMLDivElement[]> {
  const pages: HTMLDivElement[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages && !isCancelled(); pageNumber++) {
    const page = await doc.getPage(pageNumber);
    // Draw at the pane's width in device pixels, so pages stay sharp on high-DPI screens.
    const scale = (width / page.getViewport({ scale: 1 }).width) * window.devicePixelRatio;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    // Until the next redraw, the browser scales the drawing to the pane's current width.
    canvas.style.width = "100%";
    canvas.style.display = "block";
    await page.render({ canvas, viewport }).promise;

    const wrapper = document.createElement("div");
    wrapper.dataset.page = String(pageNumber);
    wrapper.style.position = "relative";
    wrapper.style.marginBottom = `${PAGE_GAP}px`;
    wrapper.append(canvas, createDrawingLayer(canvas));
    pages.push(wrapper);
  }
  return pages;
}

function drawingLayers(pages: HTMLElement): HTMLCanvasElement[] {
  return [...pages.querySelectorAll<HTMLCanvasElement>("canvas[data-drawing-layer]")];
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pageBoxes(pages: HTMLElement): PageBox[] {
  return [...pages.children].map((child) => {
    const element = child as HTMLElement;
    return { top: element.offsetTop, height: element.offsetHeight };
  });
}

// Keeps the spot at the top edge of the scroll pane in place when the pages change size.
// The spot is recorded whenever the user scrolls. Scrolling that the browser does on its own
// because the pages changed size is not recorded; the observer undoes it instead.
function useKeepTopInPlace(
  scrollRef: RefObject<HTMLElement | null>,
  pagesRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const scroll = scrollRef.current!;
    const pages = pagesRef.current!;
    let anchor: ScrollAnchor = { page: 0, fraction: 0 };
    let pagesHeight = pages.offsetHeight; // height when the anchor was last valid

    function onScroll() {
      if (pages.offsetHeight === pagesHeight) {
        anchor = anchorAt(pageBoxes(pages), scroll.scrollTop);
      }
    }
    const observer = new ResizeObserver(() => {
      pagesHeight = pages.offsetHeight;
      scroll.scrollTop = scrollTopFor(pageBoxes(pages), anchor);
    });

    scroll.addEventListener("scroll", onScroll);
    observer.observe(pages);
    return () => {
      scroll.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollRef, pagesRef]);
}

// The element's content width in pixels, updated once it has stopped changing for `delay` ms.
// Width 0 (the pane is hidden) is ignored, so hiding and showing the pane doesn't cause a redraw.
function useSettledWidth(ref: RefObject<HTMLElement | null>, delay: number): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let timer: number | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const newWidth = Math.round(entry.contentRect.width);
      window.clearTimeout(timer);
      if (newWidth === 0) {
        return;
      }
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
