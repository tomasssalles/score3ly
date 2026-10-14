// `analyze`'s observations (DESIGN.md §6), read-only, with links into the pages: a place ("system 17, bar line 4")
// opens the pages with the layout's numbered boxes, that system in the middle of the view. While the pages are open,
// only the item that was clicked is shown above them, in a thin strip; closing the pages shows the whole list again.
// (To try out; it may evolve.) The metadata, `analyze`'s and `fix_metadata`'s, is MetadataView's.

import type { Place } from "@score3ly/prompts";
import { useEffect, useState, type ReactNode } from "react";
import type { StoredObservations } from "./analyze";
import { fetchJsonContent, type Project } from "./api";
import { LayoutFilmstrip } from "./ArtifactView";
import { CloseIcon } from "./icons";
import { MetadataView } from "./MetadataView";
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
  // A place as a link: it opens the pages with that system in the middle.
  const at = (p: Place, what: string) => {
    const label = p.barLine === 0 ? `system ${p.system}` : `system ${p.system}, bar line ${p.barLine}`;
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
  const range = (start: Place, end: Place) => (
    <>
      {at(start, "from")} – {at(end, "to")}
    </>
  );
  const text = (label: string, value: string) =>
    value && (
      <li className="analysis-row">
        <span className="field-label">{label}</span>
        <span className="field-text">{value}</span>
      </li>
    );
  return (
    <>
      <section>
        <h3>The whole score</h3>
        <ul>
          {text("Instrumentation", score.instrumentation)}
          {text("Style", score.style)}
          {text("Form", score.form)}
          {score.repeats.map((r, i) => (
            <li key={`r${i}`} className="analysis-row">
              <span className="field-label">Repeat</span>
              <span className="field-text">
                {r.text} {range(r.from, r.to)}
                {r.endings.map((e, j) => (
                  <span key={j}>
                    {" "}
                    · ending {e.numbers} {range(e.start, e.end)}
                  </span>
                ))}
              </span>
            </li>
          ))}
          {score.recurringMaterial.map((m, i) => (
            <li key={`m${i}`} className="analysis-row">
              <span className="field-label">Recurs</span>
              <span className="field-text">
                {m.description}{" "}
                {m.places.map((p, j) => (
                  <span key={j}>{at(p, m.description)} </span>
                ))}
              </span>
            </li>
          ))}
          {text("For the transcription", score.notesForExtraction)}
        </ul>
      </section>
      {pages.map((page) => (
        <section key={page.page}>
          <h3>Page {page.page}</h3>
          <ul>
            {page.systems.map((s) => (
              <li key={`s${s.system}`} className="analysis-row">
                <span className="field-label">{at({ system: s.system, barLine: 0 }, `${s.staves} staves`)}</span>
                <span className="field-text">
                  {s.staves} stave{s.staves === 1 ? "" : "s"}
                  {s.instruments.length > 0 && `: ${s.instruments.join(", ")}`}
                </span>
              </li>
            ))}
            {page.changes.map((c, i) => (
              <li key={`c${i}`} className="analysis-row">
                <span className="field-label">{c.kind[0].toUpperCase() + c.kind.slice(1)}</span>
                <span className="field-text">
                  {c.text} {at(c, c.text)}
                </span>
              </li>
            ))}
            {page.specialBarLines.map((b, i) => (
              <li key={`b${i}`} className="analysis-row">
                <span className="field-label">Bar line</span>
                <span className="field-text">
                  {BAR_LINES[b.kind] ?? b.kind} {at(b, BAR_LINES[b.kind] ?? b.kind)}
                </span>
              </li>
            ))}
            {page.endings.map((e, i) => (
              <li key={`e${i}`} className="analysis-row">
                <span className="field-label">Ending {e.numbers}</span>
                <span className="field-text">
                  {e.fromPreviousPage && "from the previous page "}
                  {range(e.start, e.end)}
                  {e.toNextPage && " on to the next page"}
                </span>
              </li>
            ))}
            {page.directions.map((d, i) => (
              <li key={`d${i}`} className="analysis-row">
                <span className="field-label">Direction</span>
                <span className="field-text">
                  {d.text} {at(d, d.text)}
                </span>
              </li>
            ))}
            {text("Notes", page.notes)}
          </ul>
        </section>
      ))}
    </>
  );
}

const BAR_LINES: Record<string, string> = {
  double: "Double bar line",
  final: "Final bar line",
  startRepeat: "Start repeat",
  endRepeat: "End repeat",
  startEndRepeat: "End and start repeat",
  dashed: "Dashed bar line",
};
