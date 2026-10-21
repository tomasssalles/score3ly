// The Transcription (DESIGN.md §6, "The Transcription"), `extract`'s artifact: a filmstrip of the systems, each with
// its crop of the original and, below it, its music, rendered by Verovio from a small MEI of the system alone, or, for
// debugging, the raw source as the lens has it. The boxes of the issues and warnings are drawn on every crop they fall
// on (numbered and solid for issues, dashed with "!" for warnings), and their text is below the system; tapping a box
// brings its text into view. Both toggles are remembered on the device.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CLAUDE_IMAGE_LIMIT, CROP_VERSION, DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import { buildMei, serialize, type LensStretch, type Score } from "@score3ly/notation";
import { fetchJsonContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import type { StoredExtraction, StoredIssue, StoredScoreChecks, StoredWarning } from "./extract";
import { BoxesIcon, MusicIcon, SourceIcon } from "./icons";
import type { PageLayout } from "./layout";
import { ModeToggle } from "./pageEditor";
import { cropImage, type CropRecipe } from "./pageImages";
import type { Artifact } from "./pipeline";
import { renderMei } from "./rendering";
import { boxesOnCrop, homeOf, notesOf, scoreOf, shownSystem, type Note, type ShownSystem } from "./transcription";

type Loaded = { systems: (ShownSystem & { recipe: CropRecipe })[]; notes: Note[]; score: Score | { problem: string } };

function useTranscription(artifact: Artifact): Loaded | "error" | null {
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  const data = artifact.extraction!;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pages = artifact.pages ?? [];
      const [layouts, extractions, pieces, checks] = await Promise.all([
        Promise.all(pages.map(async (p) => [p.page, (await fetchJsonContent(p.layoutSha256!)) as PageLayout] as const)).then((l) => new Map(l)),
        Promise.all(data.systems.map(async (s) => ({ index: s.index, extraction: (await fetchJsonContent(s.sha256)) as StoredExtraction }))),
        data.piecesSha256 ? (fetchJsonContent(data.piecesSha256) as Promise<number[]>) : Promise.resolve([1]),
        data.checksSha256 ? (fetchJsonContent(data.checksSha256) as Promise<StoredScoreChecks>) : Promise.resolve(null),
      ]);
      const systems = extractions
        .sort((a, b) => a.extraction.system - b.extraction.system)
        .flatMap(({ index, extraction }) => {
          const page = pages.find((p) => p.page === extraction.page);
          const layout = layouts.get(extraction.page);
          const system = layout?.systems[index - 1];
          if (!page || !layout || !system) return [];
          const shown = shownSystem(extraction, system);
          const recipe: CropRecipe = {
            straight: { page: page.recipe, angle: layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION },
            box: shown.crop,
            crop: CROP_VERSION,
            limit: CLAUDE_IMAGE_LIMIT,
            scale: SCALE_VERSION,
          };
          return [{ ...shown, recipe }];
        });
      if (!cancelled) setLoaded({ systems, notes: notesOf(systems, checks), score: scoreOf(systems, pieces) });
    })().catch(() => !cancelled && setLoaded("error"));
    return () => {
      cancelled = true;
    };
  }, [data.systems.map((s) => s.sha256).join(), data.piecesSha256, data.checksSha256]);
  return loaded;
}

// The two toggles, remembered on this device (DESIGN.md §5.8, device settings).
function useRemembered<T extends string>(key: string, initial: T, values: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key) as T | null;
      return stored && values.includes(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      // Not remembered, then.
    }
  };
  return [value, set];
}

type View = "rendered" | "raw";
const VIEWS = [
  { value: "rendered" as const, label: "Rendering", title: "The music, rendered", icon: <MusicIcon /> },
  { value: "raw" as const, label: "Raw source", title: "The raw source (LilyPond-based)", icon: <SourceIcon /> },
];

export function ExtractionView({ artifact }: { artifact: Artifact }) {
  const loaded = useTranscription(artifact);
  const [view, setView] = useRemembered<View>("score3ly.transcription.view", "rendered", ["rendered", "raw"]);
  const [boxes, setBoxes] = useRemembered<"shown" | "hidden">("score3ly.transcription.boxes", "shown", ["shown", "hidden"]);
  // Each note's text below its system, and its colour: the layout's 7 colours (§6, `fix_layout`), in turn in the
  // order the texts are shown, so neighbouring boxes differ. The box, its label and its card share it.
  const { homes, colors } = useMemo(() => {
    const homes = new Map<number, Note[]>();
    const colors = new Map<string, string>();
    if (loaded && loaded !== "error") {
      for (const note of loaded.notes) {
        const home = homeOf(note, loaded.systems) ?? loaded.systems[0]?.extraction.system;
        if (home !== undefined) homes.set(home, [...(homes.get(home) ?? []), note]);
      }
      for (const s of loaded.systems) {
        for (const note of homes.get(s.extraction.system) ?? []) colors.set(note.key, LAYOUT_COLOR_HEX[colors.size % LAYOUT_COLOR_HEX.length]);
      }
    }
    return { homes, colors };
  }, [loaded]);

  if (loaded === "error") return <div className="text-view"><p>The transcription couldn't be loaded.</p></div>;
  if (!loaded) return <div className="text-view"><p>Loading the transcription…</p></div>;
  const { systems, notes, score } = loaded;
  const reveal = (key: string) => document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return (
    <div className="transcription">
      <div className="editor-toolbar">
        <ModeToggle modes={VIEWS} mode={view} onChange={setView} />
        <div className="editor-tools editor-modes">
          <button
            type="button"
            className="editor-mode"
            aria-pressed={boxes === "shown"}
            aria-label={boxes === "shown" ? "Hide the boxes" : "Show the boxes"}
            title={boxes === "shown" ? "Hide the boxes of issues and warnings" : "Show the boxes of issues and warnings"}
            onClick={() => setBoxes(boxes === "shown" ? "hidden" : "shown")}
          >
            <BoxesIcon />
          </button>
        </div>
      </div>
      {boxes === "shown" && (
        <p className="editor-hint">Numbered boxes are questions about what the page says. Dashed boxes mark places where the transcription doesn't add up.</p>
      )}
      <Filmstrip
        count={systems.length}
        wide={true}
        render={(i) => {
          const s = systems[i];
          const { extraction } = s;
          const own = homes.get(extraction.system) ?? [];
          return (
            <figure className="film-item">
              <figcaption>
                System {extraction.system} · page {extraction.page}
              </figcaption>
              <CropView recipe={s.recipe} label={`System ${extraction.system}`}>
                {boxes === "shown" && <BoxOverlay boxes={boxesOnCrop(notes, extraction.page, s.crop)} colors={colors} onPick={reveal} />}
              </CropView>
              {view === "rendered" ? <SystemRendering score={score} system={extraction.system} /> : <RawSource extraction={extraction} />}
              {own.length > 0 && (
                <div className="system-notes">
                  {own.map((note) =>
                    note.kind === "issue" ? (
                      <IssueCard key={note.key} id={note.key} issue={note.issue} color={colors.get(note.key)} />
                    ) : (
                      <WarningCard key={note.key} id={note.key} warning={note.warning} color={colors.get(note.key)} />
                    ),
                  )}
                </div>
              )}
            </figure>
          );
        }}
      />
    </div>
  );
}

// Starts work for an element once it scrolls near the view: a filmstrip of 50 systems would otherwise cut and render
// every one at once.
function useNear() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "100% 0px" });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return { ref, near };
}

// A crop, from the device's cache or cut again from its page (DESIGN.md §5.3), with what is drawn over it.
function CropView({ recipe, label, children }: { recipe: CropRecipe; label: string; children?: ReactNode }) {
  const { ref, near } = useNear();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    cropImage(recipe).then(
      (png) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setUrl(objectUrl);
      },
      (err) => !cancelled && setError(`This system can't be drawn: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [near, JSON.stringify(recipe)]);
  return (
    <div ref={ref} className="page-image">
      {url ? <img src={url} alt={label} /> : <div className="page-placeholder crop-placeholder">{error ?? "Drawing the system…"}</div>}
      {url && children}
    </div>
  );
}

// The boxes of issues and warnings on a crop, each in its note's colour: an SVG stretched over it, the labels as buttons.
function BoxOverlay({
  boxes,
  colors,
  onPick,
}: {
  boxes: { note: Note; box: { left: number; right: number; top: number; bottom: number } }[];
  colors: Map<string, string>;
  onPick: (key: string) => void;
}) {
  if (boxes.length === 0) return null;
  return (
    <>
      <svg className="note-boxes" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {boxes.map(({ note, box }, i) => (
          <rect
            key={i}
            className={note.kind === "issue" ? "note-box issue" : "note-box warning"}
            stroke={colors.get(note.key)}
            x={box.left}
            y={box.top}
            width={box.right - box.left}
            height={box.bottom - box.top}
            onClick={() => onPick(note.key)}
          />
        ))}
      </svg>
      {boxes.map(({ note, box }, i) => (
        <button
          key={i}
          type="button"
          className={note.kind === "issue" ? "note-label issue" : "note-label warning"}
          style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, background: colors.get(note.key) }}
          title={note.kind === "issue" ? `Issue #${note.issue.id}` : "Warning"}
          onClick={() => onPick(note.key)}
        >
          {note.kind === "issue" ? note.issue.id : "!"}
        </button>
      ))}
    </>
  );
}

// The system rendered by Verovio from a small MEI of its own, once it scrolls near the view.
function SystemRendering({ score, system }: { score: Score | { problem: string }; system: number }) {
  const { ref, near } = useNear();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>("problem" in score ? `The music can't be rendered: ${score.problem}` : null);
  useEffect(() => {
    if (!near || "problem" in score) return;
    let cancelled = false;
    (async () => {
      const mei = serialize(buildMei(score, { systems: [system] }));
      const rendered = await renderMei(mei);
      if (!cancelled) setSvg(rendered);
    })().catch((err) => !cancelled && setError(`This system can't be rendered: ${err instanceof Error ? err.message : err}`));
    return () => {
      cancelled = true;
    };
  }, [near, score, system]);
  return (
    <div ref={ref} className="system-rendering">
      {svg ? (
        // At its own size (its view box, in pixels), narrower where the view is: a short system isn't blown up.
        <div className="rendering" style={{ maxWidth: naturalWidth(svg) }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="rendering-placeholder">{error ?? "Rendering the music…"}</div>
      )}
    </div>
  );
}

function naturalWidth(svg: string): number | undefined {
  const m = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) [\d.]+"/.exec(svg.slice(0, 1000));
  return m ? Number(m[1]) + 8 : undefined; // the padding around it
}

const CLASS_LABELS: Record<LensStretch["class"], string> = { new: "new measure", continues: "continues the measure", none: "no measure" };

function stretchHead(s: LensStretch): string {
  const parts = [`Stretch ${s.stretch}`, s.class === "new" && s.kind !== "normal" ? `${CLASS_LABELS.new}, ${s.kind}` : CLASS_LABELS[s.class]];
  if (s.printedNumber) parts.push(`m. ${s.printedNumber}`);
  for (const c of s.changes) parts.push(`staff ${c.staff}: ${[c.key && `key ${c.key}`, c.time && `time ${c.time}`].filter(Boolean).join(", ")}`);
  if (s.ending) parts.push(`ending${s.ending.label ? ` ${s.ending.label}` : ""}${s.ending.startsHere ? " starts" : ""}${s.ending.endsHere ? " ends" : ""}`);
  if (s.rightBarLine !== "single") parts.push(`bar line: ${s.rightBarLine}`);
  return parts.join(" · ");
}

// The raw source (LilyPond-based), as the lens has it: the staves at the system's start, then each stretch with its
// voices.
function RawSource({ extraction }: { extraction: StoredExtraction }) {
  const { answer } = extraction;
  return (
    <div className="system-music">
      <p className="system-staves">
        {answer.startRepeat && "Start repeat · "}
        {answer.staves.map((s) => `staff ${s.staff}${s.label ? ` "${s.label}"` : ""}: ${s.clef}, key ${s.key}${s.time ? `, ${s.time}` : ""}`).join(" · ")}
        {answer.lastMeasureContinues && " · the last measure continues"}
      </p>
      {answer.stretches.map((s) => (
        <div key={s.stretch} className="stretch-music">
          <p className="stretch-head">{stretchHead(s)}</p>
          {s.voices.map((v) => (
            <pre key={v.voice}>
              <span className="voice-name">
                v{v.voice}/s{v.staff}
              </span>{" "}
              {v.music}
            </pre>
          ))}
        </div>
      ))}
    </div>
  );
}

function IssueCard({ id, issue, color }: { id: string; issue: StoredIssue; color?: string }) {
  return (
    <div className="issue-card" id={id} style={{ borderLeftColor: color }}>
      <p className="issue-head">
        #{issue.id} · {issue.class}
        {issue.source === "code" ? " · raised by code" : ""}
      </p>
      <p>
        {issue.location ? `${issue.location}: ` : ""}
        {issue.question}
      </p>
      {issue.answers.length > 0 && (
        <ul>
          {issue.answers.map((a) => (
            <li key={a.key} className={a.key === issue.applied ? "applied" : undefined}>
              {a.key}) {a.text}
              {a.key === issue.applied ? " ✓" : ""}
            </li>
          ))}
        </ul>
      )}
      {issue.lilypond && <p className="issue-tokens">{issue.lilypond.join(" ")}</p>}
    </div>
  );
}

// A warning, in the same card as an issue: nothing to answer, only its explanation.
function WarningCard({ id, warning, color }: { id: string; warning: StoredWarning; color?: string }) {
  return (
    <div className="issue-card warning" id={id} style={{ borderLeftColor: color }}>
      <p className="issue-head">! · warning</p>
      <p>{warning.message}</p>
    </div>
  );
}
