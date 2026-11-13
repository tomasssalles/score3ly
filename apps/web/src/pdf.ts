// Loading a PDF with pdf.js and drawing its pages, for the PDF view and the thumbnail of its first page.

import { useEffect, useState } from "react";
// Only the types of pdf.js here: pdf.js itself is loaded when a PDF is first shown (`loadPdfjs`), so it isn't in the
// bundle every visit downloads (apps/web/vite.config.ts, the build's size warning).
import type * as Pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
// The data files pdf.js loads at runtime, served by the pdfjsAssets plugin (packages/core).
import { PDFJS_DATA } from "@score3ly/core/pdf";

// The legacy build: the modern one needs very recent browser features (e.g. Map.getOrInsertComputed)
// that many phones don't have yet.
async function loadPdfjs(): Promise<typeof Pdfjs> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}


export type PdfDocument = Pdfjs.PDFDocumentProxy;

// Where the Worker serves a PDF. The browser caches it for good: the hash never gets another content.
export function pdfUrl(sha256: string): string {
  return `/api/pdfs/${sha256}/file`;
}

// The PDF at `url`, once it is loaded, or the error if it can't be.
export function usePdf(url: string): { doc?: PdfDocument; error?: string } {
  const [doc, setDoc] = useState<PdfDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let loadingTask: Pdfjs.PDFDocumentLoadingTask | undefined;
    async function load() {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const pdfjs = await loadPdfjs();
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

  return { doc, error };
}

// Drawing a page is shared with the evaluation viewer (packages/core).
export { drawPage } from "@score3ly/core/pdf";
