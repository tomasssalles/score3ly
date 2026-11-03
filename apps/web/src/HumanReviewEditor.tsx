// The screen of a WIP `human_review` (docs/stages/music.md, `human_review`, "The screen"): the original, page by page,
// straightened as the layout says, with the boxes of all issues on it, dimmed; tapping a box (or its number) selects its
// issue, which is no longer dimmed, and opens a panel with the issue: its question, its answers, who chose what. The
// user chooses one of the answers or writes one of their own; each choice is saved at once. Arrow buttons go from issue
// to issue in the score's order, bringing its box into view, with the panel staying open.
//
// Built in steps (docs/tasks.md): answering existing issues. The rendering beside the original, the warnings and the
// user's own issues come later.

import { DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION } from "@score3ly/imaging";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJsonContent, putContent, recordOutputs, type Project } from "./api";
import { AnswerTags, Choices, ISSUE_CLASS_LABELS, useRemembered } from "./ExtractionView";
import type { StoredExtraction, StoredIssue, StoredScoreChecks } from "./extract";
import { jsonBytes } from "./finishFixMetadata";
import { chooseAnswer, clearChoice, humanReviewedIssues, scoreOrder, userChoice, writeAnswer, type StoredHumanReview } from "./humanReview";
import { BackIcon, BoxesIcon, ChevronDownIcon, ForwardIcon } from "./icons";
import { ImagesDiffer } from "./ImagesDiffer";
import type { PageLayout } from "./layout";
import { PageCanvas, PageNav, usePageImage, useViewport, ZoomTools, type Point } from "./pageEditor";
import { straightPage } from "./pageImages";
import type { Artifact, Chooser } from "./pipeline";
import type { PageRecipe } from "./rasterize";
import { answerTags } from "./transcription";

// What a human review saved on this device and the pipeline the app has doesn't show yet, by stage.
const saved = new Map<string, StoredHumanReview>();

type Page = { page: number; recipe: PageRecipe; layout: PageLayout };
type Loaded = { pages: Page[]; issues: StoredIssue[]; stored: StoredHumanReview };

export function HumanReviewEditor({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const data = artifact.extraction!;
  const stageId = artifact.editor!.stageId;
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pages, extractions, checks, stored] = await Promise.all([
        Promise.all(
          (artifact.pages ?? []).map(async (p) => ({ page: p.page, recipe: p.recipe, layout: (await fetchJsonContent(p.layoutSha256!)) as PageLayout })),
        ),
        Promise.all(data.systems.map(async (s) => (await fetchJsonContent(s.sha256)) as StoredExtraction)),
        data.checksSha256 ? (fetchJsonContent(data.checksSha256) as Promise<StoredScoreChecks>) : Promise.resolve(null),
        saved.get(stageId) ?? (data.human?.sha256 ? (fetchJsonContent(data.human.sha256) as Promise<StoredHumanReview>) : Promise.resolve({ entries: [] })),
      ]);
      const issues = [...extractions.flatMap((e) => e.issues), ...(checks?.issues ?? [])];
      if (!cancelled) setLoaded({ pages: pages.sort((a, b) => a.page - b.page), issues, stored });
    })().catch(() => !cancelled && setLoaded("error"));
    return () => {
      cancelled = true;
    };
  }, [stageId]);
  if (loaded === "error") return <div className="text-view"><p>The transcription couldn't be loaded.</p></div>;
  if (!loaded) return <div className="text-view"><p>Loading the transcription…</p></div>;
  if (loaded.pages.length === 0) return <div className="text-view"><p>There are no pages to review.</p></div>;
  return <Screen project={project} stageId={stageId} loaded={loaded} choosers={data.choosers} onEdited={onEdited} />;
}

// In screen px: a label's size, per digit and fixed.
const LABEL = { height: 18, digit: 8, padding: 8 };

function Screen({
  project,
  stageId,
  loaded,
  choosers,
  onEdited,
}: {
  project: Project;
  stageId: string;
  loaded: Loaded;
  choosers: Record<string, Chooser>;
  onEdited?: () => void;
}) {
  const { pages } = loaded;
  const [stored, setStored] = useState(loaded.stored);
  // The latest answers, for changes that follow each other before a render (a field left, then an answer tapped).
  const latest = useRef(loaded.stored);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [boxes, setBoxes] = useRemembered<"shown" | "hidden">("score3ly.humanReview.boxes", "shown", ["shown", "hidden"]);
  const [error, setError] = useState<string | null>(null);
  const chain = useRef(Promise.resolve());

  // The issues in the score's order, each with its colour, and as the user's answers leave them (for the suffixes).
  const order = useMemo(
    () => scoreOrder(loaded.issues, (n) => pages.find((p) => p.page === n)?.layout.systems.map((s) => s.box) ?? []),
    [loaded.issues],
  );
  const colors = useMemo(() => new Map(order.map((issue, i) => [issue.id, LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length]])), [order]);
  const answered = useMemo(
    () => humanReviewedIssues(new Map(order.map((i) => [i.id, i])), stored, stageId),
    [order, stored],
  );

  const page = pages[index];
  const { image, error: imageError } = usePageImage(
    () => straightPage({ page: page.recipe, angle: page.layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION }),
    String(page.page),
  );
  const W = image?.width ?? 1;
  const H = image?.height ?? 1;
  const onPage = order.flatMap((issue) => issue.boxes.filter((b) => b.page === page.page).map((b) => ({ issue, box: b.box })));

  // What a tap at a point selects: a label first, then the smallest box under it; tapping again where boxes overlap
  // goes through them.
  function issueAt(q: Point, scale: number): number | null {
    if (boxes === "hidden") return null;
    for (const { issue, box } of [...onPage].reverse()) {
      const width = (String(issue.id).length * LABEL.digit + LABEL.padding + (userChoice(stored, issue.id) ? LABEL.digit + 2 : 0)) / scale;
      if (q.x >= box.left * W && q.x <= box.left * W + width && q.y >= box.top * H && q.y <= box.top * H + LABEL.height / scale) return issue.id;
    }
    const under = onPage
      .filter(({ box }) => q.x >= box.left * W && q.x <= box.right * W && q.y >= box.top * H && q.y <= box.bottom * H)
      .sort((a, b) => (a.box.right - a.box.left) * (a.box.bottom - a.box.top) - (b.box.right - b.box.left) * (b.box.bottom - b.box.top))
      .map((u) => u.issue.id);
    const ids = [...new Set(under)];
    if (ids.length === 0) return null;
    const at = selected === null ? -1 : ids.indexOf(selected);
    return ids[(at + 1) % ids.length];
  }

  const viewport = useViewport<never>(image, {
    tap: (q, scale) => setSelected(issueAt(q, scale)),
  });

  // Goes to an issue: its page, its first box in view.
  function go(id: number) {
    const issue = order.find((i) => i.id === id);
    setSelected(id);
    const first = issue?.boxes[0];
    if (!first) return;
    const target = pages.findIndex((p) => p.page === first.page);
    if (target < 0) return;
    if (target !== index) setIndex(target);
    const size = target === index && image ? { w: W, h: H } : null;
    // The box in image px; on another page its size is known only once its image is there, so the fractions wait.
    // After the next paint: the panel opening (below the page on a narrow screen) makes the view smaller.
    if (size) {
      requestAnimationFrame(() =>
        viewport.show({ left: first.box.left * size.w, right: first.box.right * size.w, top: first.box.top * size.h, bottom: first.box.bottom * size.h }),
      );
    } else pendingBox.current = first.box;
  }
  const pendingBox = useRef<{ left: number; right: number; top: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!image || !pendingBox.current) return;
    const b = pendingBox.current;
    pendingBox.current = null;
    viewport.show({ left: b.left * W, right: b.right * W, top: b.top * H, bottom: b.bottom * H });
  }, [image]);

  const position = selected === null ? -1 : order.findIndex((i) => i.id === selected);
  const step = (by: number) => {
    if (order.length === 0) return;
    const next = position < 0 ? (by > 0 ? 0 : order.length - 1) : (position + by + order.length) % order.length;
    go(order[next].id);
  };

  // A change of the user's answers: shown, and saved, one save after the other.
  function change(update: (current: StoredHumanReview) => StoredHumanReview) {
    const next = update(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    setStored(next);
    saved.set(stageId, next);
    chain.current = chain.current
      .then(async () => {
        const sha256 = await putContent(jsonBytes(next), "application/json");
        await recordOutputs(project, stageId, [{ item: "", type: "human_review", contentSha256: sha256 }]);
        setError(null);
        onEdited?.();
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === "TEXTAREA" || (event.target as HTMLElement).tagName === "INPUT") return;
    if (event.key === "Escape") setSelected(null);
    else if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
    else return;
    event.preventDefault();
  }

  const s = viewport.scale;
  const issue = selected === null ? null : (answered.get(selected) ?? null);
  return (
    <div className="human-review" onKeyDown={onKeyDown}>
      <div className="page-editor">
        <div className="editor-toolbar page-editor-toolbar" onClick={viewport.focus}>
          <PageNav nav={{ index, count: pages.length, go: (i) => setIndex(Math.max(0, Math.min(pages.length - 1, i))) }} />
          <div className="editor-tools">
            <button type="button" className="icon-button" aria-label="Previous issue" title="Previous issue" disabled={order.length === 0} onClick={() => step(-1)}>
              <BackIcon />
            </button>
            <span className="editor-page">
              Issue {position < 0 ? "–" : position + 1}/{order.length}
            </span>
            <button type="button" className="icon-button" aria-label="Next issue" title="Next issue" disabled={order.length === 0} onClick={() => step(1)}>
              <ForwardIcon />
            </button>
          </div>
          <ZoomTools viewport={viewport} />
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={boxes === "shown"}
              aria-label={boxes === "shown" ? "Hide the boxes" : "Show the boxes"}
              title={boxes === "shown" ? "Hide the boxes of the issues" : "Show the boxes of the issues"}
              onClick={() => setBoxes(boxes === "shown" ? "hidden" : "shown")}
            >
              <BoxesIcon />
            </button>
          </div>
        </div>
        <p className="editor-hint">
          {order.length === 0 ? "There are no issues to answer." : "Tap a box to answer its issue. A ✓ marks the issues you answered."}
        </p>
        <PageCanvas
          viewport={viewport}
          image={image}
          className="hand"
          label={`Page ${page.page}: the issues`}
          error={imageError ?? error}
          notice={<ImagesDiffer page={page.recipe} />}
        >
          {image && boxes === "shown" && (
            <>
              {onPage.map(({ issue: i, box }, k) => {
                const label = `${i.id}${userChoice(stored, i.id) ? " ✓" : ""}`;
                return (
                  <g key={k} stroke={colors.get(i.id)} className={i.id === selected ? "review-box selected" : "review-box"}>
                    <rect x={box.left * W} y={box.top * H} width={(box.right - box.left) * W} height={(box.bottom - box.top) * H} fill="none" />
                    <rect
                      className="layout-label"
                      x={box.left * W}
                      y={box.top * H}
                      width={(label.length * LABEL.digit + LABEL.padding) / s}
                      height={LABEL.height / s}
                      fill={colors.get(i.id)}
                    />
                    <text className="layout-label-text" x={box.left * W + LABEL.padding / 2 / s} y={box.top * H + (LABEL.height - 5) / s} fontSize={13 / s}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </PageCanvas>
      </div>
      {issue && (
        <IssuePanel
          key={issue.id}
          issue={issue}
          original={order.find((i) => i.id === issue.id)!}
          color={colors.get(issue.id)}
          choosers={choosers}
          mine={userChoice(stored, issue.id)}
          onChoose={(key) => change((current) => chooseAnswer(current, order.find((i) => i.id === issue.id)!, key))}
          onWrite={(text) => change((current) => writeAnswer(current, order.find((i) => i.id === issue.id)!, text))}
          onClear={() => change((current) => clearChoice(current, issue.id))}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// The selected issue: what it asks, its answers to choose from (the user's choice marked), a field for an answer of
// one's own, and who chose what. `issue` is as the user's answers leave it (a written answer among the answers);
// `original` as the transcription has it, which the choices are made on.
function IssuePanel({
  issue,
  original,
  color,
  choosers,
  mine,
  onChoose,
  onWrite,
  onClear,
  onClose,
}: {
  issue: StoredIssue;
  original: StoredIssue;
  color?: string;
  choosers: Record<string, Chooser>;
  mine: { key: string; newAnswer: { key: string; text: string } | null } | null;
  onChoose: (key: string) => void;
  onWrite: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // The last row, an answer of the user's own: its letter the next one, its text a field ("Other"). Typing in it
  // chooses it; its text stays there while another answer is chosen, and choosing it again uses it. An empty field
  // chosen adds nothing until something is typed; emptying it takes the answer back.
  const otherKey = String.fromCharCode("a".charCodeAt(0) + original.answers.length);
  const [text, setText] = useState(mine?.newAnswer?.text ?? "");
  const [pending, setPending] = useState(false); // the row chosen, its text not saved yet
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const otherChosen = mine?.newAnswer != null || pending;
  // The field's text as the answer: written, or, emptied, taken back. Text saves when the typing pauses or the field is
  // left (docs/style.md, "Confirmations, saving and undo").
  function commit(value: string) {
    clearTimeout(timer.current);
    if (value.trim()) {
      if (value.trim() !== mine?.newAnswer?.text) onWrite(value);
      // The text of one of the answers chooses that one (writeAnswer).
      if (original.answers.some((a) => a.text.trim().toLowerCase() === value.trim().toLowerCase())) setPending(false);
    } else if (mine?.newAnswer) onClear();
  }
  function type(value: string) {
    setText(value);
    setPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), 800);
  }
  function pickOther() {
    if (otherChosen) {
      clearTimeout(timer.current);
      setPending(false);
      if (mine?.newAnswer) onClear();
    } else if (text.trim()) onWrite(text);
    else {
      setPending(true);
      field.current?.focus();
    }
  }
  return (
    <aside className="issue-panel" aria-label={`Issue ${issue.id}`} style={{ borderTopColor: color }}>
      <div className="issue-panel-head">
        <p className="issue-head">
          #{issue.id} · {ISSUE_CLASS_LABELS[issue.class]}
          {issue.source === "code" ? " · raised by code" : ""}
        </p>
        <button type="button" className="icon-button" aria-label="Hide the issue" title="Hide the issue" onClick={onClose}>
          <ChevronDownIcon />
        </button>
      </div>
      <p className="issue-question">
        {issue.location ? `${issue.location}: ` : ""}
        {issue.question}
      </p>
      <div className="answer-list" role="radiogroup" aria-label="Answers">
        {original.answers.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={mine?.key === a.key && !mine.newAnswer && !pending}
            className="answer-option"
            onClick={() => {
              clearTimeout(timer.current);
              setPending(false);
              if (mine?.key === a.key && !mine.newAnswer) onClear();
              else onChoose(a.key);
            }}
          >
            <span className="answer-mark" aria-hidden="true" />
            <span>
              {a.key}) {a.text}
              <AnswerTags tags={answerTags(issue, a.key, choosers)} />
            </span>
          </button>
        ))}
        <div className="answer-option answer-other" role="radio" aria-checked={otherChosen} tabIndex={-1} onClick={(e) => e.target === field.current || pickOther()}>
          <span className="answer-mark" aria-hidden="true" />
          <span className="answer-other-key">{otherKey})</span>
          <input
            ref={field}
            type="text"
            className="answer-other-field"
            aria-label="Another answer"
            value={text}
            placeholder="Other"
            onChange={(e) => type(e.target.value)}
            onFocus={() => {
              if (!otherChosen && text.trim()) onWrite(text);
              else if (!otherChosen) setPending(true);
            }}
            onBlur={() => {
              commit(text);
              if (!text.trim()) setPending(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(text);
            }}
          />
          {mine?.newAnswer && <AnswerTags tags={answerTags(issue, mine.newAnswer.key, choosers)} />}
        </div>
      </div>
      {issue.lilypond && (
        <p className="issue-facts">
          LilyPond equivalent: <span className="issue-tokens">{issue.lilypond.join(" ")}</span>
        </p>
      )}
      {issue.choices.length > 0 && <Choices choices={issue.choices} choosers={choosers} />}
    </aside>
  );
}
