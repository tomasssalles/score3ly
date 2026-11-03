// The screen of a WIP `human_review` (docs/stages/music.md, `human_review`, "The screen"): the original, page by page,
// straightened as the layout says, with the boxes of all issues and warnings on it, dimmed, and beside it (below it on a
// narrow screen) the rendering of the transcription, system by system, its scrolling and zoom linked to the original's.
// Tapping a box (or its label) selects its issue or warning, which is no longer dimmed, and its panel covers the
// rendering: an issue's question and answers (the user chooses one or writes their own), a warning's explanation, or
// the user's own issue, raised with the box tool. Every change is saved at once. Arrow buttons go from box to box in the
// score's order, bringing it into view, with the panel staying open.

import { DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION } from "@score3ly/imaging";
import type { Box } from "@score3ly/notation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fetchJsonContent, putContent, recordOutputs, reserveIssueNumbers, type Project } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { AnswerTags, Choices, ISSUE_CLASS_LABELS, SystemRendering, useRemembered } from "./ExtractionView";
import type { StoredExtraction, StoredIssue, StoredScoreChecks, StoredWarning } from "./extract";
import { jsonBytes } from "./finishFixMetadata";
import { boxThrough } from "./fixLayout";
import {
  boxesProblem,
  chooseAnswer,
  clearChoice,
  humanReviewedIssues,
  mapThrough,
  ownIssue,
  ownIssues,
  putOwnIssue,
  removeOwnIssue,
  scoreOrder,
  userChoice,
  writeAnswer,
  type StoredHumanReview,
} from "./humanReview";
import { BackIcon, BoxIcon, ChevronDownIcon, ForwardIcon, HandIcon, LinkIcon, MoreIcon, UnlinkIcon } from "./icons";
import { ImagesDiffer } from "./ImagesDiffer";
import type { PageLayout } from "./layout";
import { ModeToggle, PageCanvas, PageNav, usePageImage, useViewport, ZoomTools, type Point } from "./pageEditor";
import { straightPage } from "./pageImages";
import type { Artifact, Chooser } from "./pipeline";
import type { PageRecipe } from "./rasterize";
import type { PlacedSystem } from "./review";
import { answerTags, scoreOf, shownSystem, type ShownSystem } from "./transcription";

// What a human review saved on this device and the pipeline the app has doesn't show yet, by stage.
const saved = new Map<string, StoredHumanReview>();

type Page = { page: number; recipe: PageRecipe; layout: PageLayout };
type Loaded = {
  pages: Page[];
  issues: StoredIssue[];
  warnings: { key: string; warning: StoredWarning }[];
  systems: ShownSystem[];
  pieces: number[];
  stored: StoredHumanReview;
};

export function HumanReviewEditor({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const data = artifact.extraction!;
  const stageId = artifact.editor!.stageId;
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pages, extractions, checks, pieces, stored] = await Promise.all([
        Promise.all(
          (artifact.pages ?? []).map(async (p) => ({ page: p.page, recipe: p.recipe, layout: (await fetchJsonContent(p.layoutSha256!)) as PageLayout })),
        ),
        Promise.all(data.systems.map(async (s) => ({ index: s.index, extraction: (await fetchJsonContent(s.sha256)) as StoredExtraction }))),
        data.checksSha256 ? (fetchJsonContent(data.checksSha256) as Promise<StoredScoreChecks>) : Promise.resolve(null),
        data.piecesSha256 ? (fetchJsonContent(data.piecesSha256) as Promise<number[]>) : Promise.resolve([1]),
        saved.get(stageId) ?? (data.human?.sha256 ? (fetchJsonContent(data.human.sha256) as Promise<StoredHumanReview>) : Promise.resolve({ entries: [] })),
      ]);
      const systems = extractions
        .sort((a, b) => a.extraction.system - b.extraction.system)
        .flatMap(({ index, extraction }) => {
          const system = pages.find((p) => p.page === extraction.page)?.layout.systems[index - 1];
          return system ? [shownSystem(extraction, system)] : [];
        });
      const issues = [...systems.flatMap((s) => s.extraction.issues), ...(checks?.issues ?? [])];
      const warnings = [
        ...systems.flatMap((s) => s.extraction.warnings.map((warning, i) => ({ key: `warning-${s.extraction.system}-${i}`, warning }))),
        ...(checks?.warnings ?? []).map((warning, i) => ({ key: `warning-score-${i}`, warning })),
      ];
      if (!cancelled) setLoaded({ pages: pages.sort((a, b) => a.page - b.page), issues, warnings, systems, pieces, stored });
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

// In screen px: a label's size, per character and fixed.
const LABEL = { height: 18, digit: 8, padding: 8 };

// An issue (the transcription's, or the user's own) or a warning, with its boxes on the pages.
type Item =
  | { kind: "issue"; key: string; boxes: { page: number; box: Box }[]; issue: StoredIssue; own: boolean }
  | { kind: "warning"; key: string; boxes: { page: number; box: Box }[]; warning: StoredWarning };

const MODES = [
  { value: "hand" as const, label: "Hand", title: "Hand: pan, select a box", icon: <HandIcon /> },
  { value: "box" as const, label: "New issue", title: "New issue: click or tap at two opposite corners of a box", icon: <BoxIcon /> },
];

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
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"hand" | "box">("hand");
  const [anchor, setAnchor] = useState<Point | null>(null); // the box tool's first corner, in image px
  const [hover, setHover] = useState<Point | null>(null);
  const [boxes, setBoxes] = useRemembered<"shown" | "hidden">("score3ly.humanReview.boxes", "shown", ["shown", "hidden"]);
  const [original, setOriginal] = useRemembered<"shown" | "hidden">("score3ly.humanReview.original", "shown", ["shown", "hidden"]);
  const [linked, setLinked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null); // why a box wasn't added
  const chain = useRef(Promise.resolve());

  const placed: PlacedSystem[] = useMemo(
    () => loaded.systems.map((s) => ({ number: s.extraction.system, page: s.extraction.page, layout: s.layout })),
    [loaded.systems],
  );
  const systemsOn = (n: number) => pages.find((p) => p.page === n)?.layout.systems.map((s) => s.box) ?? [];

  // Everything with a box, in the score's order, each with its colour; the transcription's issues as the user's answers
  // leave them (for the suffixes).
  const items: Item[] = useMemo(
    () =>
      scoreOrder<Item>(
        [
          ...loaded.issues.map((issue): Item => ({ kind: "issue", key: `issue-${issue.id}`, boxes: issue.boxes, issue, own: false })),
          ...ownIssues(stored).map((issue): Item => ({ kind: "issue", key: `issue-${issue.id}`, boxes: issue.boxes, issue, own: true })),
          ...loaded.warnings.map(({ key, warning }): Item => ({ kind: "warning", key, boxes: warning.boxes, warning })),
        ],
        systemsOn,
      ),
    [loaded, stored],
  );
  const colors = useMemo(() => {
    const c = new Map<string, string>();
    [...loaded.issues.map((i) => `issue-${i.id}`), ...loaded.warnings.map((w) => w.key)].forEach((k, i) => c.set(k, LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length]));
    // The user's own issues continue the cycle, in the order raised, so a colour doesn't change while one is drawn.
    ownIssues(stored).forEach((issue, i) => c.set(`issue-${issue.id}`, LAYOUT_COLOR_HEX[(c.size + i) % LAYOUT_COLOR_HEX.length]));
    return c;
  }, [loaded, stored]);
  const answered = useMemo(() => humanReviewedIssues(new Map(loaded.issues.map((i) => [i.id, i])), stored, stageId), [loaded.issues, stored]);
  const selectedItem = items.find((i) => i.key === selected) ?? null;
  const selectedOwn = selectedItem?.kind === "issue" && selectedItem.own ? selectedItem.issue : null;

  const page = pages[index];
  const { image, error: imageError } = usePageImage(
    () => straightPage({ page: page.recipe, angle: page.layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION }),
    String(page.page),
  );
  const W = image?.width ?? 1;
  const H = image?.height ?? 1;
  const frac = (q: Point) => ({ x: q.x / W, y: q.y / H });
  const labelOf = (item: Item) =>
    item.kind === "warning" ? "!" : `${item.issue.id}${!item.own && userChoice(stored, item.issue.id) ? " ✓" : ""}`;
  const onPage = items.flatMap((item) => item.boxes.flatMap((b, k) => (b.page === page.page ? [{ item, box: b.box, k }] : [])));

  // What a tap at a point selects: a label first, then the smallest box under it; tapping again where boxes overlap
  // goes through them.
  function itemAt(q: Point, scale: number): string | null {
    if (boxes === "hidden") return null;
    for (const { item, box } of [...onPage].reverse()) {
      const width = (labelOf(item).length * LABEL.digit + LABEL.padding) / scale;
      if (q.x >= box.left * W && q.x <= box.left * W + width && q.y >= box.top * H && q.y <= box.top * H + LABEL.height / scale) return item.key;
    }
    const area = (b: Box) => (b.right - b.left) * (b.bottom - b.top);
    const keys = [
      ...new Set(
        onPage
          .filter(({ box }) => q.x >= box.left * W && q.x <= box.right * W && q.y >= box.top * H && q.y <= box.bottom * H)
          .sort((a, b) => area(a.box) - area(b.box))
          .map((u) => u.item.key),
      ),
    ];
    if (keys.length === 0) return null;
    const at = selected === null ? -1 : keys.indexOf(selected);
    return keys[(at + 1) % keys.length];
  }

  // A box drawn with the box tool: added to the selected own issue, or a new issue of the user's own.
  async function addBox(box: Box) {
    const placedBox = { page: page.page, box };
    if (selectedOwn) {
      const next = [...selectedOwn.boxes, placedBox];
      const why = boxesProblem(next, placed);
      setProblem(why);
      if (!why) change((current) => putOwnIssue(current, ownIssue(stageId, selectedOwn.id, next, selectedOwn.answers[0]?.text ?? "")));
      return;
    }
    const why = boxesProblem([placedBox], placed);
    setProblem(why);
    if (why) return;
    try {
      const id = await reserveIssueNumbers(project, 1);
      change((current) => putOwnIssue(current, ownIssue(stageId, id, [placedBox], "")));
      setSelected(`issue-${id}`);
    } catch (err) {
      setError(`The issue couldn't be raised: ${err instanceof Error ? err.message : err}`);
    }
  }

  const viewport = useViewport<never>(image, {
    tap: (q, scale) => {
      if (mode === "hand") return setSelected(itemAt(q, scale));
      if (!anchor) return setAnchor(q);
      const box = boxThrough(frac(anchor), frac(q));
      if (!box) return; // too small to be meant: the corner waits for another tap
      setAnchor(null);
      void addBox(box);
    },
    hover: (q) => setHover(mode === "box" ? q : null),
  });

  // Goes to an item: its page, its first box in view.
  const pendingBox = useRef<Box | null>(null);
  function go(key: string) {
    const item = items.find((i) => i.key === key);
    setSelected(key);
    const first = item?.boxes[0];
    if (!first) return;
    const target = pages.findIndex((p) => p.page === first.page);
    if (target < 0) return;
    if (target !== index) {
      setIndex(target);
      pendingBox.current = first.box;
      return;
    }
    // After the next paint: the panel opening makes the view smaller.
    const b = first.box;
    requestAnimationFrame(() => viewport.show({ left: b.left * W, right: b.right * W, top: b.top * H, bottom: b.bottom * H }));
  }
  useEffect(() => {
    if (!image || !pendingBox.current) return;
    const b = pendingBox.current;
    pendingBox.current = null;
    viewport.show({ left: b.left * W, right: b.right * W, top: b.top * H, bottom: b.bottom * H });
  }, [image]);

  const position = selected === null ? -1 : items.findIndex((i) => i.key === selected);
  const step = (by: number) => {
    if (items.length === 0) return;
    const next = position < 0 ? (by > 0 ? 0 : items.length - 1) : (position + by + items.length) % items.length;
    go(items[next].key);
  };

  // A change of what the user did: shown, and saved, one save after the other.
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

  function switchMode(next: "hand" | "box") {
    setMode(next);
    setAnchor(null);
    setHover(null);
    setProblem(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === "TEXTAREA" || (event.target as HTMLElement).tagName === "INPUT") return;
    if (event.key === "Escape") {
      if (anchor) setAnchor(null);
      else setSelected(null);
    } else if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
    else return;
    event.preventDefault();
  }

  // --- The rendering, linked to the original (docs/stages/music.md, `human_review`, "Scrolling and zooming are
  // linked"): system by system, piecewise linear, so that the same place is in the middle of both; and the zoom so that
  // a system has the same width on both sides. Whichever side the user moves leads; the other follows.
  const score = useMemo(() => scoreOf(loaded.systems, loaded.pieces), [loaded]);
  const pane = useRef<HTMLDivElement>(null);
  const rendered = useRef(new Map<number, HTMLElement>());
  const leader = useRef<{ side: "original" | "rendering"; until: number } | null>(null);
  const showRendering = original === "hidden" || selectedItem === null;
  const showOriginal = original === "shown";
  const bothShown = showRendering && showOriginal;
  // The page's systems (their tops and bottoms on the page, in image px) and their renderings' (in the pane's scroll px).
  function anchorsOn(n: number): { page: number[]; rendering: number[] } {
    const page: number[] = [];
    const rendering: number[] = [];
    for (const s of loaded.systems.filter((x) => x.extraction.page === n)) {
      const el = rendered.current.get(s.extraction.system);
      if (!el) continue;
      page.push(s.layout.box.top * H, s.layout.box.bottom * H);
      rendering.push(el.offsetTop, el.offsetTop + el.offsetHeight);
    }
    return { page, rendering };
  }
  const leading = (side: "original" | "rendering") => leader.current !== null && leader.current.side !== side && Date.now() < leader.current.until;
  // The rendering scrolled to a system on another page: where the original goes once that page is drawn.
  const pendingMiddle = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!image || pendingMiddle.current === null) return;
    const a = anchorsOn(page.page);
    const y = mapThrough(a.rendering, a.page, pendingMiddle.current);
    pendingMiddle.current = null;
    leader.current = { side: "rendering", until: Date.now() + 300 };
    if (y !== null) viewport.center({ x: W / 2, y });
  }, [image]);
  // The original moved: the rendering follows.
  useLayoutEffect(() => {
    if (!linked || !bothShown || !image || leading("original") || !pane.current) return;
    const m = viewport.middle();
    if (!m) return;
    const a = anchorsOn(page.page);
    const target = mapThrough(a.page, a.rendering, m.y);
    if (target === null) return;
    leader.current = { side: "original", until: Date.now() + 200 };
    pane.current.scrollTop = target - pane.current.clientHeight / 2;
  }, [viewport.view, linked, bothShown, image, index]);
  // The rendering scrolled by the user: the original follows (to another page if the system is there).
  function onRenderingScroll() {
    const el = pane.current;
    if (!linked || !bothShown || !el || leading("rendering")) return;
    const middle = el.scrollTop + el.clientHeight / 2;
    let nearest: ShownSystem | null = null;
    let distance = Infinity;
    for (const s of loaded.systems) {
      const r = rendered.current.get(s.extraction.system);
      if (!r) continue;
      const d = middle < r.offsetTop ? r.offsetTop - middle : middle > r.offsetTop + r.offsetHeight ? middle - r.offsetTop - r.offsetHeight : 0;
      if (d < distance) [nearest, distance] = [s, d];
    }
    if (!nearest) return;
    leader.current = { side: "rendering", until: Date.now() + 200 };
    const target = pages.findIndex((p) => p.page === nearest!.extraction.page);
    if (target !== index) {
      pendingMiddle.current = middle;
      leader.current = { side: "rendering", until: Date.now() + 5000 }; // until the page is drawn
      setIndex(target);
      return;
    }
    const a = anchorsOn(page.page);
    const y = mapThrough(a.rendering, a.page, middle);
    const m = viewport.middle();
    if (y !== null) viewport.center({ x: m?.x ?? W / 2, y });
  }
  // A system's width in the rendering: the same as on the original, at its zoom (while linked).
  const widthOf = (s: ShownSystem) => (linked && bothShown && image ? (s.layout.box.right - s.layout.box.left) * W * viewport.scale : undefined);

  const s = viewport.scale;
  const rubber = mode === "box" && anchor && hover ? boxThrough(frac(anchor), frac(hover)) : null;
  const hint =
    problem ??
    (mode === "box"
      ? selectedOwn
        ? `Tap two opposite corners to add a box to issue ${selectedOwn.id}.`
        : "Tap two opposite corners of a box around what is wrong, to raise an issue of your own."
      : items.length === 0
        ? "There are no issues. To raise one, use the box tool."
        : "Tap a box to answer its issue. A ✓ marks the issues you answered.");
  const issue = selectedItem?.kind === "issue" && !selectedItem.own ? (answered.get(selectedItem.issue.id) ?? null) : null;
  return (
    <div className="human-review" onKeyDown={onKeyDown}>
      <div className="editor-toolbar page-editor-toolbar human-review-toolbar" onClick={viewport.focus}>
        {showOriginal && <PageNav nav={{ index, count: pages.length, go: (i) => setIndex(Math.max(0, Math.min(pages.length - 1, i))) }} />}
        <div className="editor-tools">
          <button type="button" className="icon-button" aria-label="Previous box" title="Previous issue or warning" disabled={items.length === 0} onClick={() => step(-1)}>
            <BackIcon />
          </button>
          <span className="editor-page" title="Issues and warnings">
            Box {position < 0 ? "–" : position + 1}/{items.length}
          </span>
          <button type="button" className="icon-button" aria-label="Next box" title="Next issue or warning" disabled={items.length === 0} onClick={() => step(1)}>
            <ForwardIcon />
          </button>
        </div>
        {showOriginal && <ModeToggle modes={MODES} mode={mode} onChange={switchMode} />}
        {showOriginal && <ZoomTools viewport={viewport} />}
        {bothShown && (
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={linked}
              aria-label={linked ? "Unlink the rendering from the original" : "Link the rendering to the original"}
              title={linked ? "Linked: the rendering follows the original. Click to unlink." : "Unlinked. Click to link the rendering to the original again."}
              onClick={() => setLinked(!linked)}
            >
              {linked ? <LinkIcon /> : <UnlinkIcon />}
            </button>
          </div>
        )}
        <DropdownMenu
          icon={<MoreIcon />}
          label="More"
          groups={[
            [
              { label: boxes === "shown" ? "Hide the boxes" : "Show the boxes", onSelect: () => setBoxes(boxes === "shown" ? "hidden" : "shown") },
              { label: original === "shown" ? "Hide the original" : "Show the original", onSelect: () => setOriginal(original === "shown" ? "hidden" : "shown") },
            ],
            ...(showOriginal ? [[{ label: "New issue", onSelect: () => { setSelected(null); switchMode("box"); } }]] : []),
          ]}
        />
      </div>
      {showOriginal && <p className={problem ? "editor-hint hint-problem" : "editor-hint"}>{hint}</p>}
      <div className="human-review-panes">
        {showOriginal && (
          <div className="page-editor">
            <PageCanvas
              viewport={viewport}
              image={image}
              className={mode === "box" ? "box" : "hand"}
              label={`Page ${page.page}: the issues and warnings`}
              error={imageError ?? error}
              notice={<ImagesDiffer page={page.recipe} />}
            >
              {image && (
                <>
                  {boxes === "shown" &&
                    onPage.map(({ item, box, k }) => {
                      const label = labelOf(item);
                      const color = colors.get(item.key);
                      return (
                        <g
                          key={`${item.key}-${k}`}
                          stroke={color}
                          className={`review-box${item.kind === "warning" ? " warning" : ""}${item.key === selected ? " selected" : ""}`}
                        >
                          <rect x={box.left * W} y={box.top * H} width={(box.right - box.left) * W} height={(box.bottom - box.top) * H} fill="none" />
                          <rect
                            className="layout-label"
                            x={box.left * W}
                            y={box.top * H}
                            width={(label.length * LABEL.digit + LABEL.padding) / s}
                            height={LABEL.height / s}
                            fill={color}
                          />
                          <text className="layout-label-text" x={box.left * W + LABEL.padding / 2 / s} y={box.top * H + (LABEL.height - 5) / s} fontSize={13 / s}>
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  {rubber && (
                    <rect
                      className="editor-rubber"
                      x={rubber.left * W}
                      y={rubber.top * H}
                      width={(rubber.right - rubber.left) * W}
                      height={(rubber.bottom - rubber.top) * H}
                      fill="none"
                    />
                  )}
                  {mode === "box" && anchor && <circle className="editor-anchor" cx={anchor.x} cy={anchor.y} r={5 / s} />}
                </>
              )}
            </PageCanvas>
          </div>
        )}
        {showRendering && (
          <div className="review-rendering" ref={pane} onScroll={onRenderingScroll} aria-label="The transcription, rendered">
            {loaded.systems.map((sys) => (
              <figure
                key={sys.extraction.system}
                className="review-rendering-system"
                ref={(el) => {
                  if (el) rendered.current.set(sys.extraction.system, el);
                  else rendered.current.delete(sys.extraction.system);
                }}
              >
                <figcaption>System {sys.extraction.system}</figcaption>
                <SystemRendering score={score} system={sys.extraction.system} changed={NO_CHANGES} width={widthOf(sys)} />
              </figure>
            ))}
          </div>
        )}
        {selectedItem?.kind === "warning" && (
          <WarningPanel key={selectedItem.key} warning={selectedItem.warning} color={colors.get(selectedItem.key)} onClose={() => setSelected(null)} />
        )}
        {selectedOwn && (
          <OwnIssuePanel
            key={selectedOwn.id}
            issue={selectedOwn}
            color={colors.get(`issue-${selectedOwn.id}`)}
            systems={placed}
            onWrite={(text) => change((current) => putOwnIssue(current, ownIssue(stageId, selectedOwn.id, selectedOwn.boxes, text)))}
            onRemoveBox={(k) => change((current) => putOwnIssue(current, ownIssue(stageId, selectedOwn.id, selectedOwn.boxes.filter((_, j) => j !== k), selectedOwn.answers[0]?.text ?? "")))}
            onAddBox={() => switchMode("box")}
            onDelete={() => {
              change((current) => removeOwnIssue(current, selectedOwn.id));
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
          />
        )}
        {issue && (
          <IssuePanel
            key={issue.id}
            issue={issue}
            original={loaded.issues.find((i) => i.id === issue.id)!}
            color={colors.get(`issue-${issue.id}`)}
            choosers={choosers}
            mine={userChoice(stored, issue.id)}
            onChoose={(key) => change((current) => chooseAnswer(current, loaded.issues.find((i) => i.id === issue.id)!, key))}
            onWrite={(text) => change((current) => writeAnswer(current, loaded.issues.find((i) => i.id === issue.id)!, text))}
            onClear={() => change((current) => clearChoice(current, issue.id))}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

const NO_CHANGES = new Set<string>();

// A warning's panel: its explanation, nothing to answer (docs/stages/music.md, `human_review`, "Warnings use the same UI").
function WarningPanel({ warning, color, onClose }: { warning: StoredWarning; color?: string; onClose: () => void }) {
  return (
    <aside className="issue-panel" aria-label="Warning" style={{ borderTopColor: color }}>
      <div className="issue-panel-head">
        <p className="issue-head">! · warning</p>
        <button type="button" className="icon-button" aria-label="Hide the warning" title="Hide the warning" onClick={onClose}>
          <ChevronDownIcon />
        </button>
      </div>
      <p className="issue-question">{warning.message}</p>
      <p className="issue-facts">Something in the transcription doesn't add up here. Nothing to answer: if it shows a mistake, raise an issue of your own.</p>
    </aside>
  );
}

// The user's own issue: the correction, its boxes (each removable while another is left), and Delete.
function OwnIssuePanel({
  issue,
  color,
  systems,
  onWrite,
  onRemoveBox,
  onAddBox,
  onDelete,
  onClose,
}: {
  issue: StoredIssue;
  color?: string;
  systems: PlacedSystem[];
  onWrite: (text: string) => void;
  onRemoveBox: (k: number) => void;
  onAddBox: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(issue.answers[0]?.text ?? "");
  const field = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!issue.answers[0]) field.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  function commit(value: string) {
    clearTimeout(timer.current);
    if (value.trim() !== (issue.answers[0]?.text ?? "")) onWrite(value);
  }
  const where = (b: { page: number; box: Box }) => {
    const on = systems.filter((s) => s.page === b.page).map((s) => s.number);
    const covered = on.filter((n) => {
      const sys = systems.find((s) => s.number === n)!.layout.box;
      return Math.min(b.box.bottom, sys.bottom) > Math.max(b.box.top, sys.top);
    });
    return `page ${b.page}${covered.length ? `, system ${covered.join(" and ")}` : ""}`;
  };
  return (
    <aside className="issue-panel" aria-label={`Issue ${issue.id}`} style={{ borderTopColor: color }}>
      <div className="issue-panel-head">
        <p className="issue-head">#{issue.id} · [your correction]</p>
        <button type="button" className="icon-button" aria-label="Hide the issue" title="Hide the issue" onClick={onClose}>
          <ChevronDownIcon />
        </button>
      </div>
      <label className="own-correction">
        <span className="answer-own-label">Your correction</span>
        <textarea
          ref={field}
          rows={1}
          className="answer-other-field"
          value={text}
          placeholder="What the page says here, e.g. “This note is a C flat”"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(value), 800);
          }}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
          }}
        />
      </label>
      {!text.trim() && <p className="issue-facts hint-problem">Write the correction: the stage can't be finished without it.</p>}
      <ul className="own-boxes">
        {issue.boxes.map((b, k) => (
          <li key={k}>
            <span>
              Box {k + 1} · {where(b)}
            </span>
            {issue.boxes.length > 1 && (
              <button type="button" className="link-button" onClick={() => onRemoveBox(k)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="issue-facts">
        <button type="button" className="link-button" onClick={onAddBox}>
          Add a box
        </button>{" "}
        (at most two systems, one right after the other)
      </p>
      <p className="issue-facts">
        <button type="button" className="link-button danger-link" onClick={onDelete}>
          Delete this issue
        </button>
      </p>
    </aside>
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
  const field = useRef<HTMLTextAreaElement>(null);
  // The field grows with its text, wrapping like the other answers.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
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
      if (original.answers.some((a) => a.text.trim() === value.trim())) setPending(false);
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
          <span className="answer-other-text">
          <textarea
            ref={field}
            rows={1}
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
              // One line of text: Enter ends it, as in any field.
              if (e.key === "Enter") {
                e.preventDefault();
                commit(text);
              }
            }}
          />
          {mine?.newAnswer && (
            <span className="answer-other-tags">
              <AnswerTags tags={answerTags(issue, mine.newAnswer.key, choosers)} />
            </span>
          )}
          </span>
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
