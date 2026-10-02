// Shows all pages of a PDF one below the other, scaled to the pane's width, in a scrollable pane.

import { useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfPane({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    // Folders served by the pdfjsAssets plugin.
    const loadingTask = pdfjs.getDocument({
      url,
      wasmUrl: "/pdfjs/wasm/",
      cMapUrl: "/pdfjs/cmaps/",
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      iccUrl: "/pdfjs/iccs/",
    });
    let cancelled = false;

    async function renderPages() {
      const doc = await loadingTask.promise;
      const width = container.clientWidth;
      for (let pageNumber = 1; pageNumber <= doc.numPages && !cancelled; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        // Render at the pane's width in device pixels, so pages stay sharp on high-DPI screens.
        const scale = (width / page.getViewport({ scale: 1 }).width) * window.devicePixelRatio;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.display = "block";
        canvas.style.marginBottom = "8px";
        container.append(canvas);
        await page.render({ canvas, viewport }).promise;
      }
    }

    renderPages().catch((error) => {
      if (!cancelled) {
        container.textContent = `Could not show ${url}: ${error}`;
      }
    });

    return () => {
      cancelled = true;
      loadingTask.destroy();
      container.replaceChildren();
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflowY: "auto", scrollbarGutter: "stable", background: "#888" }}
    />
  );
}
