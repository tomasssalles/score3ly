// The Transcription (docs/stages/music.md, "The Transcription"), `extract`'s artifact: a filmstrip of the systems, each with
// its crop of the original and, below it, its music, rendered by Verovio from a small MEI of the system alone, or, for
// debugging, the raw source as the lens has it. The boxes of the issues and warnings are drawn on every crop they fall
// on (numbered and solid for issues, dashed with "!" for warnings), and their text is below the system; tapping a box
// brings its text into view. Both toggles are remembered on the device.

import { ImagesDiffer } from "./ImagesDiffer";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CLAUDE_IMAGE_LIMIT, CROP_VERSION, DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import { buildMei, serialize, type LensStretch, type Score } from "@score3ly/notation";
import { fetchJsonContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import type { StoredExtraction, StoredIssue, StoredScoreChecks, StoredWarning } from "./extract";
import { BoxesIcon, ChangesIcon, InfoIcon, MusicIcon, SourceIcon } from "./icons";
import type { PageLayout } from "./layout";
import { ModeToggle } from "./pageEditor";
import { cropImage, type CropRecipe } from "./pageImages";
import type { Artifact, Chooser } from "./pipeline";
import { renderMei } from "./rendering";
import { applyEntries, withKept, type StoredReview } from "./review";
import type { StoredApplyCall } from "./applyReview";
import { humanReviewedIssues, ownIssues, type StoredHumanReview } from "./humanReview";
import { stepInfo } from "./steps";
import { answerTags, type AnswerTag, boxesOnCrop, homeOf, notesOf, scoreOf, shownSystem, type Note, type ShownSystem } from "./transcription";

// `changed`: in a later stage's Transcription (a review's), the keys of the notes of the issues it changed: raised, or
// chose on (its kept agreements aren't changes). Null in `extract`'s, where everything is new.
// `reverted`: in an Apply review's, the issues it couldn't apply as given, with its reasons; `changedMeasures`: the
// measures whose stretches it changed ("p1m3": piece 1, its third measure), tinted in the renderings.
type Loaded = {
  changedMeasures: Set<string>;
  systems: (ShownSystem & { recipe: CropRecipe })[];
  notes: Note[];
  score: Score | { problem: string };
  changed: Set<string> | null;
  reverted: { issue: StoredIssue; reason: string }[];
};

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
      // A review's Transcription: the issues as the review leaves them (docs/stages/music.md, `review`), each system's
      // own, and the new ones under the system whose call raised them.
      let shownChecks = checks;
      let changed: Set<string> | null = null;
      if (data.review) {
        const review = data.review;
        const calls = await Promise.all(review.calls.map(async (c) => (await fetchJsonContent(c.sha256)) as StoredReview));
        const base = [...extractions.flatMap((e) => e.extraction.issues), ...(checks?.issues ?? [])];
        let issues = new Map(base.map((i) => [i.id, i]));
        for (const call of [...calls].sort((a, b) => a.system - b.system)) issues = applyEntries(issues, call, review.stageId);
        if (review.done) issues = withKept(issues, review.stageId, (by) => data.choosers[by]?.person ?? false);
        const raised = new Map(calls.map((c) => [c.system, c.entries.flatMap((e) => ("newIssue" in e ? [issues.get(e.newIssue.id)!] : []))]));
        for (const e of extractions) {
          e.extraction = { ...e.extraction, issues: [...e.extraction.issues.map((i) => issues.get(i.id)!), ...(raised.get(e.extraction.system) ?? [])] };
        }
        if (checks) shownChecks = { ...checks, issues: checks.issues.map((i) => issues.get(i.id)!) };
        changed = new Set(
          [...issues.values()]
            // A raised issue carries the review's choice too.
            .filter((i) => i.choices.some((c) => c.by === review.stageId && !c.kept))
            .map((i) => `issue-${i.id}`),
        );
      }
      // A human review's Transcription: the issues with the user's answers (docs/stages/music.md, `human_review`); the
      // issues answered are its changes.
      if (data.human) {
        const human = data.human;
        const stored: StoredHumanReview = human.sha256 ? ((await fetchJsonContent(human.sha256)) as StoredHumanReview) : { entries: [] };
        const base = [...extractions.flatMap((e) => e.extraction.issues), ...(checks?.issues ?? [])];
        const issues = humanReviewedIssues(new Map(base.map((i) => [i.id, i])), stored, human.stageId);
        for (const e of extractions) e.extraction = { ...e.extraction, issues: e.extraction.issues.map((i) => issues.get(i.id)!) };
        // The user's own issues go with the checks' (each is shown below the system its boxes fall on).
        const own = ownIssues(stored).map((i) => issues.get(i.id)!);
        shownChecks = { issues: [...(checks?.issues.map((i) => issues.get(i.id)!) ?? []), ...own], warnings: checks?.warnings ?? [] } as StoredScoreChecks;
        changed = new Set([...issues.values()].filter((i) => i.choices.some((c) => c.by === human.stageId)).map((i) => `issue-${i.id}`));
      }
      // An Apply review's Transcription: the issues it applied or reverted are its changes.
      let reverted: Loaded["reverted"] = [];
      let changedStretches: { system: number; stretch: number }[] = [];
      if (data.apply) {
        const calls = await Promise.all(data.apply.calls.map(async (c) => (await fetchJsonContent(c.sha256)) as StoredApplyCall));
        const byId = new Map([...extractions.flatMap((e) => e.extraction.issues), ...(checks?.issues ?? [])].map((i) => [i.id, i]));
        changed = new Set(calls.flatMap((c) => [...c.applied, ...c.choices.map((x) => x.issue)]).map((id) => `issue-${id}`));
        changedStretches = calls.flatMap((c) => c.changed);
        reverted = calls
          .sort((a, b) => a.system - b.system)
          .flatMap((c) => c.choices.flatMap((x) => (byId.has(x.issue) ? [{ issue: byId.get(x.issue)!, reason: x.reason }] : [])));
      }
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
      const score = scoreOf(systems, pieces);
      if (!cancelled) setLoaded({ systems, notes: notesOf(systems, shownChecks), score, changed, reverted, changedMeasures: measuresOf(score, changedStretches) });
    })().catch(() => !cancelled && setLoaded("error"));
    return () => {
      cancelled = true;
    };
  }, [
    data.systems.map((s) => s.sha256).join(),
    data.piecesSha256,
    data.checksSha256,
    data.review?.calls.map((c) => c.sha256).join(),
    data.review?.done,
    data.apply?.calls.map((c) => c.sha256).join(),
    data.human?.sha256,
  ]);
  return loaded;
}

// A toggle remembered on this device (docs/database.md, device settings): the two here, and the MEI view's score.
export function useRemembered<T extends string>(key: string, initial: T, values: readonly T[]): [T, (value: T) => void] {
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
  // In a later stage's Transcription: only the issues it changed, or everything. Only the changes when the view opens
  // (not remembered); warnings are always shown.
  const [onlyChanges, setOnlyChanges] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ element: Element; offset: number } | null>(null);
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

  // After the toggle, the element that was at the top of the view (a system or a changed issue's card, which both modes
  // show) is put back where it was, so the user goes on seeing the same part of the score.
  useLayoutEffect(() => {
    const kept = anchor.current;
    anchor.current = null;
    const scroller = frame.current?.querySelector<HTMLElement>(".filmstrip");
    if (!kept || !scroller || !kept.element.isConnected) return;
    scroller.scrollTop += kept.element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - kept.offset;
  }, [onlyChanges]);

  if (loaded === "error") return <div className="text-view"><p>The transcription couldn't be loaded.</p></div>;
  if (!loaded) return <div className="text-view"><p>Loading the transcription…</p></div>;
  const { systems, score, changed, reverted, changedMeasures } = loaded;
  const filtering = changed !== null && onlyChanges;
  const shown = (note: Note) => !filtering || note.kind !== "issue" || changed!.has(note.key);
  const notes = loaded.notes.filter(shown);
  const toggleChanges = () => {
    // The first thing still in view that both modes show: a system's caption, crop or rendering, or a changed issue's card.
    const scroller = frame.current?.querySelector<HTMLElement>(".filmstrip");
    if (scroller) {
      const top = scroller.getBoundingClientRect().top;
      const candidates = [...scroller.querySelectorAll(".film-item > figcaption, .film-item .page-image, .film-item .system-rendering, .film-item .system-music, .issue-card")].filter(
        (el) => !el.classList.contains("issue-card") || changed?.has(el.id),
      );
      const element = candidates.find((el) => el.getBoundingClientRect().bottom > top);
      anchor.current = element ? { element, offset: element.getBoundingClientRect().top - top } : null;
    }
    setOnlyChanges(!onlyChanges);
  };
  const reveal = (key: string) => document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return (
    <div className="transcription" ref={frame}>
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
        {changed !== null && (
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={onlyChanges}
              aria-label={onlyChanges ? "Show all issues" : "Show only what this stage changed"}
              title={onlyChanges ? "Show all issues" : "Show only the issues this stage changed"}
              onClick={toggleChanges}
            >
              <ChangesIcon />
            </button>
          </div>
        )}
      </div>
      {boxes === "shown" && (
        <p className="editor-hint">Numbered boxes are questions about what the page says. Dashed boxes mark places where the transcription doesn't add up.</p>
      )}
      {reverted.length > 0 && (
        <div className="reverted-block error-text" role="note">
          <p className="reverted-head">
            {reverted.length === 1 ? "1 answer couldn't be applied" : `${reverted.length} answers couldn't be applied`} as given, and{" "}
            {reverted.length === 1 ? "was" : "were"} reverted:
          </p>
          <ul>
            {reverted.map(({ issue, reason }) => (
              <li key={issue.id}>
                <button type="button" className="link-button" onClick={() => reveal(`issue-${issue.id}`)}>
                  #{issue.id}
                </button>{" "}
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Filmstrip
        count={systems.length}
        wide={true}
        render={(i) => {
          const s = systems[i];
          const { extraction } = s;
          const own = (homes.get(extraction.system) ?? []).filter(shown);
          return (
            <figure className="film-item">
              <figcaption>
                System {extraction.system} · page {extraction.page}
              </figcaption>
              <CropView recipe={s.recipe} label={`System ${extraction.system}`}>
                {boxes === "shown" && <BoxOverlay boxes={boxesOnCrop(notes, extraction.page, s.crop)} colors={colors} onPick={reveal} />}
              </CropView>
              {view === "rendered" ? <SystemRendering score={score} system={extraction.system} changed={changedMeasures} /> : <RawSource extraction={extraction} />}
              {own.length > 0 && (
                <div className="system-notes">
                  {own.map((note) =>
                    note.kind === "issue" ? (
                      <IssueCard key={note.key} id={note.key} issue={note.issue} color={colors.get(note.key)} choosers={artifact.extraction!.choosers} />
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

// A crop, from the device's cache or cut again from its page (docs/overview.md §5.3), with what is drawn over it.
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
      {url ? <img src={url} alt={label} /> : <div className="page-placeholder crop-placeholder error-text">{error ?? "Drawing the system…"}</div>}
      {url && children}
      {url && <ImagesDiffer page={recipe.straight.page} below />}
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
// `width`: its width in screen px (linked to the original's zoom, Human review), else its own size, narrower where the
// view is.
export function SystemRendering({ score, system, changed, width }: { score: Score | { problem: string }; system: number; changed: Set<string>; width?: number }) {
  const { ref, near } = useNear();
  const frame = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>("problem" in score ? `The music can't be rendered: ${score.problem}` : null);
  // The measures a stage changed: a tint behind each, in the accent colour, drawn once the SVG is in the page (its
  // boxes are known only then). A measure split across systems has a part of its own on each ("p1m3-s5t1").
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || changed.size === 0) return;
    for (const g of root.querySelectorAll<SVGGElement>("g.measure")) {
      if (!changed.has(g.id.split("-")[0])) continue;
      const box = g.getBBox();
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", "changed-measure");
      for (const [k, v] of Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height })) rect.setAttribute(k, String(v));
      g.insertBefore(rect, g.firstChild);
    }
  }, [svg, changed]);
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
        <div ref={frame} className="rendering" style={width ? { width } : { maxWidth: naturalWidth(svg) }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="rendering-placeholder error-text">{error ?? "Rendering the music…"}</div>
      )}
    </div>
  );
}

// The measures (by their MEI ids without a part's suffix) that hold any of the stretches.
function measuresOf(score: Score | { problem: string }, stretches: { system: number; stretch: number }[]): Set<string> {
  const ids = new Set<string>();
  if ("problem" in score || stretches.length === 0) return ids;
  const wanted = new Set(stretches.map((p) => `${p.system}/${p.stretch}`));
  for (const piece of score.pieces) {
    for (const m of piece.measures) {
      if (m.parts.some((p) => p.stretches.some((k) => wanted.has(`${p.system}/${k}`)))) ids.add(`p${piece.index + 1}m${m.index + 1}`);
    }
  }
  return ids;
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

// The classes of issues as users read them: words that say what the problem is (docs/stages/music.md, "An issue's card").
export const ISSUE_CLASS_LABELS: Record<StoredIssue["class"], string> = { reading: "[unclear]", format: "[cannot be encoded]" };


function IssueCard({ id, issue, color, choosers }: { id: string; issue: StoredIssue; color?: string; choosers: Record<string, Chooser> }) {
  return (
    <div className="issue-card" id={id} style={{ borderLeftColor: color }}>
      <p className="issue-head">
        #{issue.id} · {issue.source === "user" ? "[clarification]" : ISSUE_CLASS_LABELS[issue.class]}
        {issue.source === "code" ? " · raised by code" : ""}
      </p>
      <p>
        {issue.location ? `${issue.location}: ` : ""}
        {issue.question}
      </p>
      {issue.answers.length > 0 && (
        <ul>
          {issue.answers.map((a) => {
            const tags = answerTags(issue, a.key, choosers);
            return (
              <li key={a.key}>
                {a.key}) {a.text}
                <AnswerTags tags={tags} />
              </li>
            );
          })}
        </ul>
      )}
      {issue.lilypond && (
        <p className="issue-facts">
          LilyPond equivalent: <span className="issue-tokens">{issue.lilypond.join(" ")}</span>
        </p>
      )}
      {issue.choices.length > 0 && <Choices choices={issue.choices} choosers={choosers} />}
    </div>
  );
}

// An answer's suffixes, muted, the stage they name in bold (docs/stages/music.md, "An issue's card").
export function AnswerTags({ tags }: { tags: AnswerTag[] }) {
  return (
    <>
      {tags.map((t) => (
        <span key={t.words} className="answer-tag">
          {" "}[{t.words}
          {t.stage && (
            <>
              {" "}
              <strong>{t.stage}</strong>
            </>
          )}
          ]
        </span>
      ))}
    </>
  );
}

// Who chose which answer, in order; a choice with a reason has an "i" after it that shows the reason on a line below
// (docs/stages/music.md, "An issue's card": the reasons are for later reviewers, shown only on request).
export function Choices({ choices, choosers }: { choices: StoredIssue["choices"]; choosers: Record<string, Chooser> }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const name = (by: string) => choosers[by]?.label ?? stepInfo(by).title;
  const toggle = (i: number) => {
    const next = new Set(open);
    if (!next.delete(i)) next.add(i);
    setOpen(next);
  };
  return (
    <>
      <p className="issue-facts">
        Choices:{" "}
        {choices.map((c, i) => (
          <span key={i}>
            {i > 0 ? " • " : ""}
            {name(c.by)} → {c.key}
            {c.reason && (
              <button
                type="button"
                className="reason-toggle"
                aria-expanded={open.has(i)}
                aria-label={`${open.has(i) ? "Hide" : "Show"} the reason of ${name(c.by)}`}
                title={`${open.has(i) ? "Hide" : "Show"} the reason`}
                onClick={() => toggle(i)}
              >
                <InfoIcon />
              </button>
            )}
          </span>
        ))}
      </p>
      {choices.map((c, i) =>
        c.reason && open.has(i) ? (
          <p key={i} className="issue-reason">
            {name(c.by)}: {c.reason}
          </p>
        ) : null,
      )}
    </>
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
