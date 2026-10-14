// `analyze`'s artifacts (DESIGN.md §6): the metadata and the observations, read-only, with links into the pages. A
// metadata field's page opens the pages as they are, scrolled to that page, so the user can look at the others too; a
// place in the observations ("system 17, bar line 4") opens the pages with the layout's numbered boxes, that system in
// the middle of the view. While the pages are open, only the item that was clicked is shown above them, in a thin strip;
// closing the pages shows the whole list again. (To try out; it may evolve.)

import type { Place, Role, TextField } from "@score3ly/prompts";
import { useEffect, useState, type ReactNode } from "react";
import { CONFIDENCE_SYMBOLS, type ShownConfidence, type StoredMetadata, type StoredObservations } from "./analyze";
import { fetchJsonContent } from "./api";
import { Filmstrip, LayoutFilmstrip, PageImageView } from "./ArtifactView";
import { CloseIcon } from "./icons";
import type { Artifact } from "./pipeline";
import type { PageRecipe } from "./rasterize";

type Focus = { text: ReactNode; page?: number; system?: number };

export function AnalysisView({ artifact }: { artifact: Artifact }) {
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
        {analysis.view === "observations" ? (
          <LayoutFilmstrip
            pages={pages.flatMap((p) => (p.layoutSha256 ? [{ ...p, layoutSha256: p.layoutSha256 }] : []))}
            focusSystem={focus.system}
          />
        ) : (
          <PagesFilmstrip pages={pages} page={focus.page} />
        )}
      </div>
    );
  }
  return (
    <div className="text-view analysis">
      {analysis.view === "metadata" ? (
        <MetadataList metadata={data as StoredMetadata} confirmed={analysis.confirmed} onFocus={setFocus} />
      ) : (
        <ObservationsList observations={data as StoredObservations} onFocus={setFocus} />
      )}
    </div>
  );
}

// The pages as they are, opened at one of them.
function PagesFilmstrip({ pages, page }: { pages: { page: number; recipe: PageRecipe }[]; page?: number }) {
  const index = pages.findIndex((p) => p.page === page);
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      focus={index >= 0 ? { index } : undefined}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {pages[i].page}</figcaption>
          <PageImageView recipe={pages[i].recipe} />
        </figure>
      )}
    />
  );
}

function Confidence({ value }: { value: ShownConfidence }) {
  const { symbol, label } = CONFIDENCE_SYMBOLS[value];
  return (
    <span className={value === "confirmed" ? "confidence confirmed" : "confidence"} title={label} aria-label={label}>
      {symbol}
    </span>
  );
}

// The sections of the metadata (DESIGN.md §6, "Metadata"): Titles, Work, Arrangement, Pieces or movements, Edition,
// in that order. Each lists its kinds of item in a fixed order: people by their role, the other fields by name.
type Kind = { role: Role; label: string } | { field: TextField; label: string };

const WORK: Kind[] = [
  { role: "composer", label: "Composer" },
  { role: "lyricist", label: "Lyricist" },
  { role: "librettist", label: "Librettist" },
  { field: "catalogueNumbers", label: "Catalogue number" },
  { field: "dedications", label: "Dedication" },
  { field: "instrumentation", label: "Instrumentation" },
  { field: "compositionDates", label: "Composition date" },
];
const ARRANGEMENT: Kind[] = [
  { role: "arranger", label: "Arranger" },
  { role: "translator", label: "Translator" },
];
const EDITION: Kind[] = [
  { role: "editor", label: "Editor" },
  { role: "other", label: "Other" },
  { field: "publishers", label: "Publisher" },
  { field: "places", label: "Place" },
  { field: "dates", label: "Date" },
  { field: "plateNumbers", label: "Plate number" },
  { field: "notices", label: "Notice" },
];

const TITLE_TYPES: Record<string, string> = { main: "Title", subtitle: "Subtitle", alternative: "Alternative title", translated: "Translated title" };

function MetadataList({
  metadata,
  confirmed,
  onFocus,
}: {
  metadata: StoredMetadata;
  confirmed: boolean;
  onFocus: (focus: Focus) => void;
}) {
  // One field: its label and text, its page as a link, its confidence.
  const row = (key: string, label: string, text: string, item: { page: number; confidence: ShownConfidence }) => {
    const shown = confirmed ? "confirmed" : item.confidence;
    const content = (
      <>
        <span className="field-label">{label}</span>
        <span className="field-text">{text}</span>
      </>
    );
    return (
      <li key={key} className="analysis-row">
        {content}
        <button
          type="button"
          className="page-link"
          onClick={() =>
            onFocus({
              page: item.page,
              text: (
                <>
                  {content} <span className="page-link static">p. {item.page}</span> <Confidence value={shown} />
                </>
              ),
            })
          }
        >
          p. {item.page}
        </button>
        <Confidence value={shown} />
      </li>
    );
  };
  // A section's rows, kind by kind.
  const rows = (kinds: Kind[]) =>
    kinds.flatMap((kind) =>
      "role" in kind
        ? metadata.people.flatMap((p, i) =>
            p.role === kind.role ? [row(`p${i}`, kind.label, p.printedRole ? `${p.name} (${p.printedRole})` : p.name, p)] : [],
          )
        : (metadata[kind.field] ?? []).map((item, i) => row(`${kind.field}${i}`, kind.label, item.text, item)),
    );
  const section = (title: string, items: ReactNode[]) =>
    items.length > 0 && (
      <section key={title}>
        <h3>{title}</h3>
        <ul>{items}</ul>
      </section>
    );
  const sections = [
    section("Titles", metadata.titles.map((t, i) => row(`t${i}`, TITLE_TYPES[t.type] ?? "Title", t.text, t))),
    section("Work", rows(WORK)),
    section("Arrangement", rows(ARRANGEMENT)),
    section("Pieces or movements", metadata.pieces.map((p, i) => row(`m${i}`, `From system ${p.system}`, p.title, p))),
    section("Edition", rows(EDITION)),
  ];
  if (sections.every((s) => !s)) return <p className="muted">No metadata was found on the pages.</p>;
  return <>{sections}</>;
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
