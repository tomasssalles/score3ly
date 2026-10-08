import { useEffect, useRef, useState } from "react";
import { DocumentIcon } from "./icons";
import { drawPage, usePdf } from "./pdf";

const WIDTH = 160; // CSS pixels the page is drawn at; the tile's CSS shrinks it to fit

// A PDF's first page as a small picture, for its output tile. An icon stands in until it is drawn, and stays
// if the PDF can't be shown.
export function PdfThumb({ url }: { url: string }) {
  const holder = useRef<HTMLSpanElement>(null);
  const { doc } = usePdf(url);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (doc === undefined) return;
    let cancelled = false;
    drawPage(doc, 1, WIDTH)
      .then((canvas) => {
        if (!cancelled) {
          holder.current!.replaceChildren(canvas);
          setDrawn(true);
        }
      })
      .catch(() => {
        // The icon stays.
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <>
      {!drawn && <DocumentIcon />}
      <span className="pdf-thumb" ref={holder} />
    </>
  );
}
