// `analyze`'s observations (DESIGN.md §6), read-only, each item with its confidence, with links into the pages: a
// place ("system 17, bar line 4") opens the pages with the layout's numbered boxes, that system in the middle of the
// view. While the pages are open,
// only the item that was clicked is shown above them, in a thin strip; closing the pages shows the whole list again.
// (To try out; it may evolve.) The metadata, `analyze`'s and `fix_metadata`'s, is MetadataView's.

import type { BarLineItem, ChangeItem, Confidence, Place, Staff, TextItem } from "@score3ly/prompts";
import { useEffect, useState, type ReactNode } from "react";
import { placeLabel, type StoredObservations } from "./analyze";
import { fetchJsonContent, type Project } from "./api";
import { LayoutFilmstrip } from "./ArtifactView";
import { CloseIcon } from "./icons";
import { Confidence as ConfidenceSymbol, MetadataView } from "./MetadataView";
import type { Artifact } from "./pipeline";

type Focus = { text: ReactNode; system?: number };

export function AnalysisView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  if (artifact.analysis!.view === "metadata") return <MetadataView project={project} artifact={artifact} onEdited={onEdited} />;
  return <ObservationsView artifact={artifact} />;
}

function ObservationsView({ artifact }: { artifact: Artifact }) {
  const analysis = artifact.analysis!;
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJsonContent(analysis.sha256).then(
      (json) => !cancelled && setData(json),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [analysis.sha256]);

  if (error) return <div className="text-view"><p>This couldn't be loaded.</p></div>;
  if (!data) return <div className="text-view"><p>Loading…</p></div>;
  const pages = artifact.pages ?? [];

  if (focus) {
    return (
      <div className="analysis-focus">
        <div className="analysis-strip">
          <div className="analysis-strip-text">{focus.text}</div>
          <button type="button" className="icon-button" aria-label="Close the pages" onClick={() => setFocus(null)}>
            <CloseIcon />
          </button>
        </div>
        <LayoutFilmstrip
          pages={pages.flatMap((p) => (p.layoutSha256 ? [{ ...p, layoutSha256: p.layoutSha256 }] : []))}
          focusSystem={focus.system}
        />
      </div>
    );
  }
  return (
    <div className="text-view analysis">
      <ObservationsList observations={data as StoredObservations} onFocus={setFocus} />
    </div>
  );
}

function ObservationsList({ observations, onFocus }: { observations: StoredObservations; onFocus: (focus: Focus) => void }) {
  const { score, pages } = observations;
  // A place as a link: it opens the pages with that system in the middle, the item in the strip above them.
  const at = (p: Place, what: string) => {
    const label = placeLabel(p);
    return (
      <button
        type="button"
        className="page-link"
        onClick={() => onFocus({ system: p.system, text: <><span className="field-text">{what}</span> <span className="page-link static">{label}</span></> })}
      >
        {label}
      </button>
    );
  };
  // A span, either end of which may be open (it continues beyond the page).
  const span = (start: Place | null, end: Place | null, what: string) => (
    <>
      {start ? <>from {at(start, what)}</> : "from the previous page"} {end ? <>to {at(end, what)}</> : "on to the next page"}
    </>
  );
  const row = (key: string, label: ReactNode, body: ReactNode, confidence: Confidence) => (
    <li key={key} className="analysis-row">
      <span className="field-label">{label}</span>
      <span className="field-text">{body}</span>
      <ConfidenceSymbol value={confidence} />
    </li>
  );
  const texts = (label: string, items: (TextItem & { id: string })[]) => items.map((t) => row(t.id, label, t.text, t.confidence));
  const staff = (s: Staff | null) => s && <span className="staff">staff {s.number}/{s.of}</span>;
  return (
    <>
      <section>
        <h3>The whole score</h3>
        <ul>
          {texts("Instrumentation", score.instrumentation)}
          {texts("Style", score.style)}
          {texts("Form", score.form)}
          {score.recurringMaterial.map((m) =>
            row(
              m.id,
              "Recurs",
              <>
                {m.description}{" "}
                {m.places.map((p, j) => (
                  <span key={j}>{at(p, m.description)} </span>
                ))}
              </>,
              m.confidence,
            ),
          )}
          {texts("For the transcription", score.notesForTranscription)}
        </ul>
      </section>
      {pages.map((page) => (
        <section key={page.page}>
          <h3>Page {page.page}</h3>
          <ul>
            {page.systems.map((s) =>
              row(
                s.id,
                at({ system: s.system, at: "start", number: 0 }, `${s.staves} staves`),
                <>
                  {s.staves} staves{s.instruments.length > 0 && `: ${s.instruments.join(", ")}`}
                </>,
                s.confidence,
              ),
            )}
            {page.changes.map((c) =>
              row(
                c.id,
                CHANGES[c.kind],
                <>
                  {c.text} {staff(c.staff)} {at(c.place, c.text)}
                </>,
                c.confidence,
              ),
            )}
            {page.ottavas.map((o) =>
              row(
                o.id,
                "Ottava",
                <>
                  {o.text} {staff(o.staff)} {span(o.start, o.end, o.text)}
                </>,
                o.confidence,
              ),
            )}
            {page.specialBarLines.map((b) => row(b.id, "Bar line", <>{BAR_LINES[b.kind]} {at(b.place, BAR_LINES[b.kind])}</>, b.confidence))}
            {page.endings.map((e) => row(e.id, `Ending ${e.numbers}`, span(e.start, e.end, `Ending ${e.numbers}`), e.confidence))}
            {page.directions.map((d) => row(d.id, "Direction", <>{d.text} {at(d.place, d.text)}</>, d.confidence))}
            {texts("Note", page.notes)}
          </ul>
        </section>
      ))}
    </>
  );
}

const CHANGES: Record<ChangeItem["kind"], string> = { clef: "Clef", key: "Key", time: "Time", tempo: "Tempo", other: "Change" };

const BAR_LINES: Record<BarLineItem["kind"], string> = {
  double: "Double bar line",
  final: "Final bar line",
  startRepeat: "Start repeat",
  endRepeat: "End repeat",
  startEndRepeat: "End and start repeat",
  dashed: "Dashed bar line",
};
