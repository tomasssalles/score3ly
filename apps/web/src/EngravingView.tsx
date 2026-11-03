// The MEI and the PDF (docs/stages/engrave.md): `build_mei`'s MEI file in the MEI view (MeiWorkspace.tsx), read-only,
// beside the score engraved from it; and `engrave`'s PDF, the file itself.

import { useEffect, useState } from "react";
import { fetchTextContent } from "./api";
import { cachedEngravedPdf, engravedPages, engravedPdf } from "./engraving";
import { PdfView } from "./PdfView";
import { MeiWorkspace } from "./MeiWorkspace";
import type { Artifact } from "./pipeline";

type Engraving = NonNullable<Artifact["engraving"]>;

export function EngravingView({ artifact }: { artifact: Artifact }) {
  const engraving = artifact.engraving!;
  return engraving.view === "mei" ? <MeiView engraving={engraving} /> : <EngravedPdf engraving={engraving} />;
}

// --- The engraving ----------------------------------------------------------------------------------------------------

// The PDF itself, as downloaded, drawn by pdf.js like the original PDF: from the device's cache, or made again from its
// recipe when it isn't there ("Regenerating", never "Engraving": for the user the engraving already happened).
function EngravedPdf({ engraving }: { engraving: Engraving }) {
  const [url, setUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    (async () => {
      let pdf = await cachedEngravedPdf(engraving);
      if (!pdf) {
        if (!cancelled) setRegenerating(true);
        pdf = await engravedPdf(engraving);
      }
      if (cancelled) return;
      made = URL.createObjectURL(pdf);
      setUrl(made);
    })().catch((err) => !cancelled && setError(`The PDF can't be made: ${err instanceof Error ? err.message : err}`));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [engraving.meiSha256, JSON.stringify(engraving.config)]);
  if (error) return <div className="text-view"><p>{error}</p></div>;
  if (!url) return <div className="text-view"><p>{regenerating ? "Regenerating the PDF…" : "Loading the PDF…"}</p></div>;
  return <PdfView key={url} url={url} />;
}

// --- The MEI file ----------------------------------------------------------------------------------------------------

function MeiView({ engraving }: { engraving: Engraving }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pages, setPages] = useState<string[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchTextContent(engraving.meiSha256).then(
      (t) => !cancelled && setText(t.replace(/\n$/, "")),
      () => !cancelled && setError(true),
    );
    engravedPages(engraving).then(
      (svgs) => !cancelled && setPages(svgs),
      (err) => !cancelled && setPagesError(`The score can't be engraved: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
    };
  }, [engraving.meiSha256, JSON.stringify(engraving.config)]);
  if (error) return <div className="text-view"><p>The MEI file couldn't be loaded.</p></div>;
  if (text === null) return <div className="text-view"><p>Loading the MEI file…</p></div>;
  return <MeiWorkspace text={text} pages={pages} pagesError={pagesError} />;
}
