// The Transcription (docs/stages/music.md, "The Transcription"), `extract`'s artifact: a filmstrip of the systems, each with
// its crop of the original and, below it, its music, rendered by Verovio from a small MEI of the system alone, or, for
// debugging, the raw source as the lens has it. The boxes of the issues and warnings are drawn on every crop they fall
// on (numbered and solid for issues, dashed with "!" for warnings), and their text is below the system; tapping a box
// brings its text into view. Both toggles are remembered on the device.
// A human review in progress is its Transcription, editable (`edit`; docs/stages/music.md, `human_review`, "The
// screen"): the issues' answers to pick from, clarifications of the user's own below the systems, every change saved
// at once.

import { ImagesDiffer } from "./ImagesDiffer";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CLAUDE_IMAGE_LIMIT, CROP_VERSION, DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import { buildMei, serialize, type Box, type LensStretch, type Score } from "@score3ly/notation";
import { fetchJsonContent, putContent, recordOutputs, reserveIssueNumbers, type Project } from "./api";
import { Filmstrip } from "./ArtifactView";
import type { StoredExtraction, StoredIssue, StoredScoreChecks, StoredWarning } from "./extract";
import { BoxesIcon, ChangesIcon, InfoIcon, MusicIcon, SourceIcon } from "./icons";
import type { PageLayout } from "./layout";
import { ModeToggle } from "./pageEditor";
import { cropImage, type CropRecipe } from "./pageImages";
import type { Artifact } from "./pipeline";
import { attributionOf, extend, type Attribution, type IssueWho } from "./attribution";
import { attributionCache } from "./imageCache";
import { fittedOptions, renderMei } from "./rendering";
import { applyEntries, changedBy, withKept, type StoredReview } from "./review";
import type { StoredApplyCall } from "./applyReview";
import {
  boxProblems,
  chooseAnswer,
  clearChoice,
  humanReviewedIssues,
  ownIssue,
  ownIssues,
  placedSystems,
  putOwnIssue,
  removeOwnIssue,
  userChoice,
  writeAnswer,
  type StoredHumanReview,
} from "./humanReview";
import { AnswerPicker, ClarificationCard, DrawLayer } from "./HumanReviewCards";
import { jsonBytes } from "./finishFixMetadata";
import type { PlacedSystem } from "./review";
import type { Who } from "./attribution";
import { stepInfo } from "./steps";
import { answerTags, type AnswerTag, boxesOnCrop, homeOf, notesOf, scoreOf, shownSystem, type Note, type ShownSystem } from "./transcription";
import { count } from "./format";

// `changed`: in a later stage's Transcription (a review's), the keys of the notes of the issues it changed: raised, or
// chose on (its kept agreements aren't changes). Null in `extract`'s, where everything is new.
// `reverted`: in an Apply review's, the issues it couldn't apply as given, with its reasons; `changedMeasures`: the
// measures whose stretches it changed ("p1m3": piece 1, its third measure), tinted in the renderings.
// `human`: a human review's, the transcription it reviews (its issues before the review's answers) and what it stored,
// from which its issues are worked out as the answers change (`withHumanReview`).
type Loaded = {
  changedMeasures: Set<string>;
  systems: (ShownSystem & { recipe: CropRecipe })[];
  notes: Note[];
  score: Score | { problem: string };
  changed: Set<string> | null;
  reverted: { issue: StoredIssue; reason: string }[];
  attribution: Attribution; // who added each issue's choices and applications (attribution.ts)
  human: HumanBase | null;
};

type HumanBase = {
  systems: (ShownSystem & { recipe: CropRecipe })[];
  checks: StoredScoreChecks | null;
  issues: Map<number, StoredIssue>; // before the review's answers, which choices are made on
  stored: StoredHumanReview;
  before: Attribution;
  placed: PlacedSystem[]; // the systems as Finish checks the clarifications' boxes against them
};

// What a human review in progress saved on this device that the pipeline the app has doesn't show yet, by stage.
const savedReviews = new Map<string, StoredHumanReview>();

// A human review's Transcription: the issues with the user's answers, each answered issue resolved, the user's own
// issues below the systems their boxes fall on (with the checks'); the issues answered or raised are its changes.
function withHumanReview(h: HumanBase, stored: StoredHumanReview, who: Who): Pick<Loaded, "systems" | "notes" | "attribution" | "changed"> {
  const issues = humanReviewedIssues(h.issues, stored);
  const systems = h.systems.map((s) => ({ ...s, extraction: { ...s.extraction, issues: s.extraction.issues.map((i) => issues.get(i.id)!) } }));
  const own = ownIssues(stored).map((i) => issues.get(i.id)!);
  const checks = { issues: [...(h.checks?.issues.map((i) => issues.get(i.id)!) ?? []), ...own], warnings: h.checks?.warnings ?? [] };
  const shownIssues = [...systems.flatMap((s) => s.extraction.issues), ...checks.issues];
  return {
    systems,
    notes: notesOf(systems, checks),
    attribution: extend(h.before, shownIssues, who),
    changed: new Set([...changedBy([{ system: 0, entries: stored.entries }])].map((id) => `issue-${id}`)),
  };
}

function useTranscription(artifact: Artifact, stageId: string | null): Loaded | "error" | null {
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
        for (const call of [...calls].sort((a, b) => a.system - b.system)) issues = applyEntries(issues, call);
        if (review.done) issues = withKept(issues, changedBy(calls));
        const raised = new Map(calls.map((c) => [c.system, c.entries.flatMap((e) => ("newIssue" in e ? [issues.get(e.newIssue.id)!] : []))]));
        for (const e of extractions) {
          e.extraction = { ...e.extraction, issues: [...e.extraction.issues.map((i) => issues.get(i.id)!), ...(raised.get(e.extraction.system) ?? [])] };
        }
        if (checks) shownChecks = { ...checks, issues: checks.issues.map((i) => issues.get(i.id)!) };
        changed = new Set([...changedBy(calls)].map((id) => `issue-${id}`));
      }
      // A human review's: what it stored (the latest saved on this device first), its issues worked out below.
      const stored: StoredHumanReview | null = data.human
        ? ((stageId ? savedReviews.get(stageId) : undefined) ??
          (data.human.sha256 ? ((await fetchJsonContent(data.human.sha256)) as StoredHumanReview) : { entries: [] }))
        : null;
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
      // Who chose and applied: the stages before this one, kept on the device, and this one's own entries.
      const pdf = pages[0]?.recipe.pdf;
      const { attribution: before } = await attributionOf(data.chain, { json: fetchJsonContent, ...(pdf ? attributionCache(pdf) : {}) });
      const shownIssues = [...extractions.flatMap((e) => e.extraction.issues), ...(shownChecks?.issues ?? [])];
      const attribution = extend(before, shownIssues, data.who);
      const changedMeasures = measuresOf(score, changedStretches);
      let result: Loaded = { systems, notes: notesOf(systems, shownChecks), score, changed, reverted, changedMeasures, attribution, human: null };
      if (stored) {
        const human: HumanBase = {
          systems,
          checks,
          issues: new Map(shownIssues.map((i) => [i.id, i])),
          stored,
          before,
          placed: placedSystems(pages.map((p) => ({ page: p.page, systems: layouts.get(p.page)?.systems ?? [] }))),
        };
        result = { ...result, ...withHumanReview(human, stored, data.who), human };
      }
      if (!cancelled) setLoaded(result);
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

// A human review in progress: its stage, to save to, and what to tell when something is saved.
export type TranscriptionEdit = { project: Project; stageId: string; onEdited?: () => void };

export function ExtractionView({ artifact, edit }: { artifact: Artifact; edit?: TranscriptionEdit }) {
  const base = useTranscription(artifact, edit?.stageId ?? null);
  const [view, setView] = useRemembered<View>("score3ly.transcription.view", "rendered", ["rendered", "raw"]);
  const [boxes, setBoxes] = useRemembered<"shown" | "hidden">("score3ly.transcription.boxes", "shown", ["shown", "hidden"]);
  // In a later stage's Transcription: only the issues it changed, or everything. Only the changes when the view opens
  // (not remembered); warnings are always shown.
  const [onlyChanges, setOnlyChanges] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ element: Element; offset: number } | null>(null);

  // A human review in progress: what the user did, as it changes (the latest for changes that follow each other before
  // a render), saved one save after the other.
  const [stored, setStored] = useState<StoredHumanReview | null>(null);
  const latest = useRef<StoredHumanReview | null>(null);
  const chain = useRef(Promise.resolve());
  const [saveError, setSaveError] = useState<string | null>(null);
  // The clarification being edited (its boxes drawn on the crops), and the system each new one was added below, until
  // it has a box.
  const [selected, setSelected] = useState<number | null>(null);
  const [addedBelow, setAddedBelow] = useState<Map<number, number>>(new Map());
  const loaded = useMemo(() => {
    if (!base || base === "error" || !base.human || !stored) return base;
    return { ...base, ...withHumanReview(base.human, stored, artifact.extraction!.who) };
  }, [base, stored]);

  // Each note's text below its system, and its colour: the layout's 7 colours (§6, `fix_layout`), in turn in the
  // order the texts are shown, so neighbouring boxes differ; the user's own issues continue the cycle in the order
  // raised, so that adding one changes no other's colour. The box, its label and its card share it.
  const { homes, colors } = useMemo(() => {
    const homes = new Map<number, Note[]>();
    const colors = new Map<string, string>();
    if (loaded && loaded !== "error") {
      for (const note of loaded.notes) {
        const home =
          homeOf(note, loaded.systems) ?? (note.kind === "issue" ? addedBelow.get(note.issue.id) : undefined) ?? loaded.systems[0]?.extraction.system;
        if (home !== undefined) homes.set(home, [...(homes.get(home) ?? []), note]);
      }
      const own = (note: Note) => note.kind === "issue" && note.issue.source === "user";
      for (const s of loaded.systems) {
        for (const note of homes.get(s.extraction.system) ?? []) if (!own(note)) colors.set(note.key, LAYOUT_COLOR_HEX[colors.size % LAYOUT_COLOR_HEX.length]);
      }
      for (const note of [...loaded.notes].filter(own).sort((a, b) => (a.kind === "issue" && b.kind === "issue" ? a.issue.id - b.issue.id : 0))) {
        colors.set(note.key, LAYOUT_COLOR_HEX[colors.size % LAYOUT_COLOR_HEX.length]);
      }
    }
    return { homes, colors };
  }, [loaded, addedBelow]);

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
  const { systems, score, changed, reverted, changedMeasures, human } = loaded;
  const editing = edit && human ? { ...edit, human, stored: stored ?? human.stored } : null;
  // No Δ while the human review is in progress: everything is shown.
  const filtering = changed !== null && onlyChanges && !editing;
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

  // --- Editing (a human review in progress).
  function change(update: (current: StoredHumanReview) => StoredHumanReview) {
    if (!editing) return;
    const current = latest.current ?? editing.stored;
    const next = update(current);
    if (next === current) return;
    latest.current = next;
    setStored(next);
    savedReviews.set(editing.stageId, next);
    const { project, stageId, onEdited } = editing;
    chain.current = chain.current
      .then(async () => {
        const sha256 = await putContent(jsonBytes(next), "application/json");
        await recordOutputs(project, stageId, [{ item: "", type: "human_review", contentSha256: sha256 }]);
        setSaveError(null);
        onEdited?.();
      })
      .catch((err) => setSaveError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }
  const ownById = (id: number) => (editing ? ownIssues(latest.current ?? editing.stored).find((i) => i.id === id) : undefined);
  const textOf = (issue: StoredIssue) => issue.answers[0]?.text ?? "";
  async function addClarification(system: number) {
    if (!editing) return;
    try {
      const known = [...editing.human.issues.values(), ...ownIssues(latest.current ?? editing.stored)];
      const id = await reserveIssueNumbers(editing.project, 1, known);
      setAddedBelow((m) => new Map(m).set(id, system));
      change((current) => putOwnIssue(current, ownIssue(id, [], "")));
      setSelected(id);
    } catch (err) {
      setSaveError(`The clarification couldn't be added: ${err instanceof Error ? err.message : err}`);
    }
  }
  const selectedOwn = selected === null ? undefined : ownById(selected);
  const selectedHome = selectedOwn ? (homeOf({ key: "", boxes: selectedOwn.boxes, kind: "issue", issue: selectedOwn }, systems) ?? addedBelow.get(selectedOwn.id) ?? null) : null;
  const problems = new Map(editing ? ownIssues(editing.stored).map((i) => [i.id, boxProblems(i.boxes, editing.human.placed)]) : []);
  // Labels on the crops: an answered issue's with "✓", a clarification's box that breaks a rule with "!" (in red).
  const labelOf = (note: Note, k: number) => {
    if (!editing || note.kind !== "issue") return null;
    if (note.issue.source === "user") return problems.get(note.issue.id)?.bad.includes(k) ? { text: `${note.issue.id} !`, invalid: true } : null;
    return userChoice(editing.stored, note.issue.id) ? { text: `${note.issue.id} ✓`, invalid: false } : null;
  };

  return (
    <div className={editing ? "transcription editing" : "transcription"} ref={frame}>
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
        {changed !== null && !editing && (
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
      {saveError && <p className="panel-error error-text transcription-error">{saveError}</p>}
      {reverted.length > 0 && (
        <div className="reverted-block error-text" role="note">
          <p className="reverted-head">
            {count(reverted.length, "answer")} couldn't be applied as given, and{" "}
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
        overlay={
          // Over the filmstrip, not above it, and only hidden with the boxes, so that toggling them moves nothing.
          <p className="editor-hint" style={{ visibility: boxes === "shown" ? "visible" : "hidden" }}>
            {editing
              ? "Pick an answer for any issue below its system. To say what the original has where nobody asked, add a clarification."
              : "Numbered boxes are questions about what the page says. Dashed boxes mark places where the transcription doesn't add up."}
          </p>
        }
        render={(i) => {
          const s = systems[i];
          const { extraction } = s;
          const own = (homes.get(extraction.system) ?? []).filter(shown);
          const drawing = editing && selectedOwn && selectedHome !== null && Math.abs(extraction.system - selectedHome) <= 1;
          return (
            <figure className="film-item">
              <figcaption>
                System {extraction.system} · page {extraction.page}
              </figcaption>
              <CropView recipe={s.recipe} label={`System ${extraction.system}`}>
                {boxes === "shown" && <BoxOverlay boxes={boxesOnCrop(notes, extraction.page, s.crop)} colors={colors} onPick={reveal} labelOf={labelOf} />}
                {drawing && (
                  <DrawLayer
                    crop={s.crop}
                    boxes={selectedOwn.boxes.flatMap((b, k) => (b.page === extraction.page && overlaps(b.box, s.crop) ? [{ k, box: b.box }] : []))}
                    onAdd={(box) => {
                      const issue = ownById(selectedOwn.id)!;
                      change((current) => putOwnIssue(current, ownIssue(issue.id, [...issue.boxes, { page: extraction.page, box }], textOf(issue))));
                    }}
                    onResize={(k, box) => {
                      const issue = ownById(selectedOwn.id)!;
                      change((current) => putOwnIssue(current, ownIssue(issue.id, issue.boxes.map((b, j) => (j === k ? { ...b, box } : b)), textOf(issue))));
                    }}
                  />
                )}
              </CropView>
              {view === "rendered" ? <SystemRendering score={score} system={extraction.system} changed={changedMeasures} fit={{ box: s.layout.box, crop: s.crop }} /> : <RawSource extraction={extraction} />}
              {(own.length > 0 || editing) && (
                <div className="system-notes">
                  {own.map((note) => {
                    if (note.kind === "warning") return <WarningCard key={note.key} id={note.key} warning={note.warning} color={colors.get(note.key)} />;
                    const issue = note.issue;
                    if (editing && issue.source === "user") {
                      const ownIssueNow = ownById(issue.id) ?? issue;
                      return (
                        <ClarificationCard
                          key={note.key}
                          id={note.key}
                          issue={ownIssueNow}
                          color={colors.get(note.key)}
                          systems={editing.human.placed}
                          problem={problems.get(issue.id) ?? { problem: null, bad: [] }}
                          selected={selected === issue.id}
                          onSelect={(on) => setSelected(on ? issue.id : null)}
                          onWrite={(text) => change((current) => putOwnIssue(current, ownIssue(issue.id, ownById(issue.id)!.boxes, text)))}
                          onRemoveBox={(k) => {
                            const now = ownById(issue.id)!;
                            change((current) => putOwnIssue(current, ownIssue(issue.id, now.boxes.filter((_, j) => j !== k), textOf(now))));
                          }}
                          onDelete={() => {
                            change((current) => removeOwnIssue(current, issue.id));
                            if (selected === issue.id) setSelected(null);
                          }}
                        />
                      );
                    }
                    const original = editing?.human.issues.get(issue.id);
                    return (
                      <IssueCard
                        key={note.key}
                        id={note.key}
                        issue={issue}
                        color={colors.get(note.key)}
                        who={loaded.attribution[issue.id]}
                        answers={
                          editing && original ? (
                            <AnswerPicker
                              issue={issue}
                              original={original}
                              who={loaded.attribution[issue.id]}
                              mine={userChoice(editing.stored, issue.id)}
                              onChoose={(key) => change((current) => chooseAnswer(current, original, key))}
                              onWrite={(text) => change((current) => writeAnswer(current, original, text))}
                              onClear={() => change((current) => clearChoice(current, issue.id))}
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                  {editing && (
                    <button type="button" className="button-secondary add-clarification" onClick={() => void addClarification(extraction.system)}>
                      Add clarification
                    </button>
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

// Whether two boxes on a page overlap (a clarification's box and a crop: its handles only on the crops it falls on).
const overlaps = (a: Box, b: Box) => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

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
  labelOf,
}: {
  boxes: { note: Note; box: { left: number; right: number; top: number; bottom: number }; k: number }[];
  colors: Map<string, string>;
  onPick: (key: string) => void;
  labelOf?: (note: Note, k: number) => { text: string; invalid: boolean } | null; // another label than the number
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
      {boxes.map(({ note, box, k }, i) => {
        const label = labelOf?.(note, k);
        return (
          <button
            key={i}
            type="button"
            className={`${note.kind === "issue" ? "note-label issue" : "note-label warning"}${label?.invalid ? " invalid" : ""}`}
            style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, background: label?.invalid ? undefined : colors.get(note.key) }}
            title={note.kind === "issue" ? `Issue #${note.issue.id}` : "Warning"}
            onClick={() => onPick(note.key)}
          >
            {label?.text ?? (note.kind === "issue" ? note.issue.id : "!")}
          </button>
        );
      })}
    </>
  );
}

// The system rendered by Verovio from a small MEI of its own, once it scrolls near the view.
// `fit`: the system's box and crop on the page (the Transcription): rendered on the crop's share of a page and shown as
// wide as the crop (fittedOptions). Else `width`: its width in screen px (linked to the original's zoom, Human review),
// or its own size, narrower where the view is.
export function SystemRendering({
  score,
  system,
  changed,
  width,
  fit,
}: {
  score: Score | { problem: string };
  system: number;
  changed: Set<string>;
  width?: number;
  fit?: { box: Box; crop: Box };
}) {
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
      const fitted = fit && fittedOptions(fit.box, fit.crop);
      const rendered = fitted ? await renderMei(mei, fitted.options, fitted.pageWidth) : await renderMei(mei);
      if (!cancelled) setSvg(rendered);
    })().catch((err) => !cancelled && setError(`This system can't be rendered: ${err instanceof Error ? err.message : err}`));
    return () => {
      cancelled = true;
    };
    // The box and crop by their values: a new object for the same system mustn't render it again.
  }, [near, score, system, fit && JSON.stringify(fit)]);
  return (
    <div ref={ref} className="system-rendering">
      {svg ? (
        // As wide as the crop above it (`fit`), or at its own size (its view box, in pixels), narrower where the view is.
        <div
          ref={frame}
          className={fit ? "rendering fitted" : "rendering"}
          style={fit ? undefined : width ? { width } : { maxWidth: naturalWidth(svg) }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
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


// `answers`: in place of the list of answers (a human review in progress: AnswerPicker).
function IssueCard({ id, issue, color, who, answers }: { id: string; issue: StoredIssue; color?: string; who: IssueWho | undefined; answers?: ReactNode }) {
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
      {answers ??
        (issue.answers.length > 0 && (
        <ul>
          {issue.answers.map((a) => {
            const tags = answerTags(issue, a.key, who);
            return (
              <li key={a.key}>
                {a.key}) {a.text}
                <AnswerTags tags={tags} />
              </li>
            );
          })}
        </ul>
        ))}
      {issue.lilypond && issue.lilypond.length > 0 && (
        <p className="issue-facts">
          LilyPond equivalent: <span className="issue-tokens">{issue.lilypond.join(" ")}</span>
        </p>
      )}
      {issue.choices.length > 0 && <Choices choices={issue.choices} who={who} />}
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
export function Choices({ choices, who }: { choices: StoredIssue["choices"]; who: IssueWho | undefined }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const named = choices.map((c, i) => who?.choices[i]?.label ?? stepInfo(c.by).title);
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
            {named[i]} → {c.key}
            {c.reason && (
              <button
                type="button"
                className="reason-toggle"
                aria-expanded={open.has(i)}
                aria-label={`${open.has(i) ? "Hide" : "Show"} the reason of ${named[i]}`}
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
            {named[i]}: {c.reason}
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
