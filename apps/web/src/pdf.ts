// Loading a PDF with pdf.js and drawing its pages, for the PDF view and the thumbnail of its first page.

import { useEffect, useState } from "react";
// Only the types of pdf.js here: pdf.js itself is loaded when a PDF is first shown (`loadPdfjs`), so it isn't in the
// bundle every visit downloads (apps/web/vite.config.ts, the build's size warning).
import type * as Pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
// Opening a PDF with pdf.js's data files (packages/core).
import { loadPdf } from "@score3ly/core/pdf";
import { errorText } from "@score3ly/core";
import { checked } from "./api";

// The legacy build: the modern one needs very recent browser features (e.g. Map.getOrInsertComputed)
// that many phones don't have yet.
async function loadPdfjs(): Promise<typeof Pdfjs> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

export type PdfDocument = Pdfjs.PDFDocumentProxy;

// The PDF at `url`, once it is loaded, or the error if it can't be.
export function usePdf(url: string): { doc?: PdfDocument; error?: string } {
  const [doc, setDoc] = useState<PdfDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Aborted when the view goes: the fetch stops, and the document is destroyed.
    const leaving = new AbortController();
    async function load() {
      const response = await checked(await fetch(url, { signal: leaving.signal }));
      const bytes = new Uint8Array(await response.arrayBuffer());
      const pdfjs = await loadPdfjs();
      if (leaving.signal.aborted) return;
      const loaded = await loadPdf(bytes, pdfjs.getDocument, leaving.signal);
      if (!leaving.signal.aborted) setDoc(loaded);
    }
    load().catch((e) => {
      if (!leaving.signal.aborted) setError(errorText(e));
    });
    return () => leaving.abort();
  }, [url]);

  return { doc, error };
}

// Drawing a page is shared with the evaluation viewer (packages/core).
export { drawPage } from "@score3ly/core/pdf";
