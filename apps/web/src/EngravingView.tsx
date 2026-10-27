// `engrave`'s artifacts (docs/stages/engrave.md): the MEI file in the MEI view (MeiWorkspace.tsx), read-only, beside
// the score engraved from it; and the engraving, Verovio's pages, made when they are shown.

import { useEffect, useState } from "react";
import { fetchTextContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import { engravedPages } from "./engraving";
import { MeiWorkspace } from "./MeiWorkspace";
import type { Artifact } from "./pipeline";

type Engraving = NonNullable<Artifact["engraving"]>;

export function EngravingView({ artifact }: { artifact: Artifact }) {
  const engraving = artifact.engraving!;
  return engraving.view === "mei" ? <MeiView engraving={engraving} /> : <EngravedPages engraving={engraving} />;
}

// --- The engraving ---------------------------------------------------------------------------------------------------

function EngravedPages({ engraving }: { engraving: Engraving }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    engravedPages(engraving).then(
      (svgs) => !cancelled && setPages(svgs),
      (err) => !cancelled && setError(`The score can't be engraved: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
    };
  }, [engraving.meiSha256, JSON.stringify(engraving.config)]);
  if (error) return <div className="text-view"><p>{error}</p></div>;
  if (!pages) return <div className="text-view"><p>Engraving the score…</p></div>;
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {i + 1}</figcaption>
          <div className="engraved-page" dangerouslySetInnerHTML={{ __html: pages[i] }} />
        </figure>
      )}
    />
  );
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
