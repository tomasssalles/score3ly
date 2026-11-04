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
import { boxThrough, resizeBox, type BoxHandle } from "./fixLayout";
import {
  boxProblems,
  chooseAnswer,
  clearChoice,
  humanReviewedIssues,
  mapThrough,
  ownIssue,
  ownIssues,
  placedSystems,
  putOwnIssue,
  removeOwnIssue,
  scoreOrder,
  userChoice,
  writeAnswer,
  type StoredHumanReview,
} from "./humanReview";
import { BoxIcon, ChevronDownIcon, CollapseIcon, ExpandIcon, HandIcon, InfoIcon, LinkIcon, MoreIcon, UnlinkIcon } from "./icons";
import { ConfirmDialog } from "./ConfirmDialog";
import { Picker } from "./fieldList";
import { NO_TEXT } from "./humanReview";
import { ImagesDiffer } from "./ImagesDiffer";
import type { PageLayout } from "./layout";
import { BoxHandles, handleAt, ModeToggle, PageCanvas, PageNav, usePageImage, useViewport, ZoomTools, type Point } from "./pageEditor";
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
  { value: "box" as const, label: "Add clarification", title: "Add clarification: click or tap at two opposite corners of a box", icon: <BoxIcon /> },
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
  // What the screen shows (docs/stages/music.md, `human_review`, decided 2026-11-04): the original, the transcription, or
  // both (side by side, or one above the other on a narrow screen). Remembered on the device.
  const [view, setView] = useRemembered<"both" | "original" | "transcription">("score3ly.humanReview.view", "both", ["both", "original", "transcription"]);
  const [linked, setLinked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chain = useRef(Promise.resolve());

  // The systems as Finish checks the clarifications' boxes against them (finishHumanReview.ts).
  const placed: PlacedSystem[] = useMemo(() => placedSystems(pages.map((p) => ({ page: p.page, systems: p.layout.systems }))), [pages]);
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
  // While a box of one's own issue is resized: its boxes as they are, not yet a change.
  const [live, setLiveState] = useState<{ page: number; box: Box }[] | null>(null);
  const liveRef = useRef<{ page: number; box: Box }[] | null>(null);
  const setLive = (next: { page: number; box: Box }[] | null) => {
    liveRef.current = next;
    setLiveState(next);
  };
  const boxesOf = (item: Item) => (live && item.key === selected ? live : item.boxes);
  const onPage = items.flatMap((item) => boxesOf(item).flatMap((b, k) => (b.page === page.page ? [{ item, box: b.box, k }] : [])));

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

  // A box drawn with the box tool: added to the selected clarification, or a new clarification. Anything goes while the
  // user draws: what breaks the rules is shown, and checked on Finish.
  async function addBox(box: Box) {
    const placedBox = { page: page.page, box };
    if (selectedOwn) {
      const next = [...selectedOwn.boxes, placedBox];
      change((current) => putOwnIssue(current, ownIssue(stageId, selectedOwn.id, next, selectedOwn.answers[0]?.text ?? "")));
      return;
    }
    try {
      const id = await reserveIssueNumbers(project, 1, [...loaded.issues, ...ownIssues(latest.current)]);
      change((current) => putOwnIssue(current, ownIssue(stageId, id, [placedBox], "")));
      setSelected(`issue-${id}`);
    } catch (err) {
      setError(`The clarification couldn't be added: ${err instanceof Error ? err.message : err}`);
    }
  }

  // The handles of a clarification's boxes, as in `fix_layout` (pageEditor.tsx): dragging one resizes its box, saved when
  // it is let go.
  const viewport = useViewport<{ k: number; handle: BoxHandle }>(image, {
    grab: (q, scale) => {
      if (mode !== "hand" || !selectedOwn || boxes === "hidden") return null;
      for (const [k, b] of selectedOwn.boxes.entries()) {
        if (b.page !== page.page) continue;
        const handle = handleAt(b.box, q, { width: W, height: H }, scale);
        if (handle) return { k, handle };
      }
      return null;
    },
    drag: (grabbed, q) => {
      if (!selectedOwn) return;
      const current = liveRef.current ?? selectedOwn.boxes;
      setLive(current.map((b, j) => (j === grabbed.k ? { ...b, box: resizeBox(b.box, grabbed.handle, frac(q)) } : b)));
    },
    release: () => {
      const current = liveRef.current;
      setLive(null);
      if (!current || !selectedOwn) return;
      change((stored) => putOwnIssue(stored, ownIssue(stageId, selectedOwn.id, current, selectedOwn.answers[0]?.text ?? "")));
    },
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
  const showOriginal = view !== "transcription";
  // The selected annotation's panel covers the rendering when both are shown; with one of them, it is beside it.
  const showRendering = view === "transcription" || (view === "both" && selectedItem === null);
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
  // Where the rendering is: the system nearest the middle of its pane, and how far into it (0 at its top, 1 at its
  // bottom). Kept while the rendering is hidden, so that it can come back where it was, or the original can go there.
  const renderingAt = useRef<{ system: number; frac: number } | null>(null);
  function readRendering(): { system: ShownSystem; frac: number } | null {
    const el = pane.current;
    if (!el) return null;
    const middle = el.scrollTop + el.clientHeight / 2;
    let nearest: { system: ShownSystem; frac: number } | null = null;
    let distance = Infinity;
    for (const sys of loaded.systems) {
      const r = rendered.current.get(sys.extraction.system);
      if (!r || !r.offsetHeight) continue;
      const d = middle < r.offsetTop ? r.offsetTop - middle : middle > r.offsetTop + r.offsetHeight ? middle - r.offsetTop - r.offsetHeight : 0;
      if (d < distance) [nearest, distance] = [{ system: sys, frac: (middle - r.offsetTop) / r.offsetHeight }, d];
    }
    if (nearest) renderingAt.current = { system: nearest.system.extraction.system, frac: nearest.frac };
    return nearest;
  }
  // The original to a place of the rendering: its system's page, at the same height into the system.
  const pendingFollow = useRef<{ system: number; frac: number } | null>(null);
  function originalTo(at: { system: number; frac: number }) {
    const sys = loaded.systems.find((x) => x.extraction.system === at.system);
    if (!sys) return;
    const target = pages.findIndex((p) => p.page === sys.extraction.page);
    if (target < 0) return;
    if (target !== index || !image) {
      pendingFollow.current = at;
      leader.current = { side: "rendering", until: Date.now() + 5000 }; // until the page is drawn
      setIndex(target);
      return;
    }
    leader.current = { side: "rendering", until: Date.now() + 300 };
    const m = viewport.middle();
    const box = sys.layout.box;
    viewport.center({ x: m?.x ?? W / 2, y: (box.top + at.frac * (box.bottom - box.top)) * H });
  }
  useLayoutEffect(() => {
    if (!image || !pendingFollow.current) return;
    const at = pendingFollow.current;
    pendingFollow.current = null;
    originalTo(at);
  }, [image]);
  // The rendering to a place (coming back into view). Its systems are drawn as they come near the view and change height
  // then, so for a moment it is put there again as they do (`restoring`, in the resize observer below).
  const restoring = useRef<{ at: { system: number; frac: number }; until: number } | null>(null);
  function renderingTo(at: { system: number; frac: number }) {
    const el = pane.current;
    const r = rendered.current.get(at.system);
    if (!el || !r) return;
    restoring.current = { at, until: Date.now() + 1500 };
    leader.current = { side: "rendering", until: Date.now() + 300 };
    el.scrollTop = r.offsetTop + at.frac * r.offsetHeight - el.clientHeight / 2;
  }
  // A pane coming back into view (another view picked, the panel closed): linked, it goes to where the other one is;
  // unlinked, it is where it was left (the original keeps its page and zoom by itself; the rendering is put back).
  // Where the original is, in the same terms (the system nearest the middle of its view on its page), kept while it is
  // hidden.
  const originalAt = useRef<{ system: number; frac: number } | null>(null);
  useEffect(() => {
    if (!showOriginal || !image) return;
    const m = viewport.middle();
    if (!m) return;
    let best: { system: number; frac: number; d: number } | null = null;
    for (const sys of loaded.systems.filter((x) => x.extraction.page === page.page)) {
      const top = sys.layout.box.top * H;
      const bottom = sys.layout.box.bottom * H;
      const d = m.y < top ? top - m.y : m.y > bottom ? m.y - bottom : 0;
      if (!best || d < best.d) best = { system: sys.extraction.system, frac: (m.y - top) / Math.max(1, bottom - top), d };
    }
    if (best) originalAt.current = { system: best.system, frac: best.frac };
  }, [viewport.view, index, image, showOriginal]);
  const shown = useRef({ original: showOriginal, rendering: showRendering });
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { original: showOriginal, rendering: showRendering };
    // The original back: linked, to where the transcription was last.
    if (showOriginal && !before.original && linked && renderingAt.current) originalTo(renderingAt.current);
    // The transcription back: unlinked, where it was left; linked, where the original is (when both show, the alignment
    // below does it).
    if (showRendering && !before.rendering) {
      if (!linked && renderingAt.current) renderingTo(renderingAt.current);
      else if (linked && !showOriginal && originalAt.current) renderingTo(originalAt.current);
    }
  }, [showOriginal, showRendering]);
  // The original moved: the rendering follows.
  const align = useRef(() => {});
  align.current = () => {
    if (!linked || !bothShown || !image || leading("original") || !pane.current) return;
    const m = viewport.middle();
    if (!m) return;
    const a = anchorsOn(page.page);
    const target = mapThrough(a.page, a.rendering, m.y);
    if (target === null) return;
    leader.current = { side: "original", until: Date.now() + 200 };
    pane.current.scrollTop = target - pane.current.clientHeight / 2;
  };
  useLayoutEffect(() => align.current(), [viewport.view, linked, bothShown, image, index]);
  // The renderings are drawn as they come near the view, and change size then: the alignment follows.
  useEffect(() => {
    if (!showRendering) return;
    const observer = new ResizeObserver(() => {
      const back = restoring.current;
      if (back && Date.now() < back.until) renderingTo(back.at);
      else align.current();
    });
    for (const el of rendered.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [showRendering, loaded.systems]);
  // The rendering scrolled (by the user, or following): where it is is kept; linked and moved by the user, the original
  // follows, to another page if the system is there.
  function onRenderingScroll() {
    // While it is being put back, the place it is put at stays the one kept.
    if (restoring.current && Date.now() < restoring.current.until) return;
    const at = readRendering();
    if (!at || !linked || !bothShown || leading("rendering")) return;
    originalTo({ system: at.system.extraction.system, frac: at.frac });
  }
  // A system's width in the rendering: the same as on the original, at its zoom (while linked).
  const widthOf = (s: ShownSystem) => (linked && bothShown && image ? (s.layout.box.right - s.layout.box.left) * W * viewport.scale : undefined);

  const s = viewport.scale;
  const rubber = mode === "box" && anchor && hover ? boxThrough(frac(anchor), frac(hover)) : null;
  const hint =
    mode === "box"
      ? selectedOwn
        ? `Tap two opposite corners to add a box to clarification ${selectedOwn.id}.`
        : "Tap two opposite corners of a box around a place in the original, to add a clarification about it."
      : selectedOwn
        ? `Drag the handles to resize the boxes of clarification ${selectedOwn.id}; the box tool adds more.`
        : items.length === 0
          ? "There are no issues. To add a clarification, use the box tool."
          : "Tap a box to answer its issue. A ✓ marks the issues you answered.";
  // The boxes of each clarification that break a rule, drawn in red.
  const badBoxes = new Map(ownIssues(stored).map((issue) => [`issue-${issue.id}`, new Set(boxProblems(boxesOf({ kind: "issue", key: `issue-${issue.id}`, boxes: issue.boxes, issue, own: true }), placed).bad)]));
  const issue = selectedItem?.kind === "issue" && !selectedItem.own ? (answered.get(selectedItem.issue.id) ?? null) : null;
  return (
    <div className="human-review" onKeyDown={onKeyDown}>
      <div className="editor-toolbar page-editor-toolbar human-review-toolbar" onClick={viewport.focus}>
        {/* The pages and the annotations together: one row of their own on a phone. */}
        <div className="review-navs">
        {showOriginal && <PageNav nav={{ index, count: pages.length, go: (i) => setIndex(Math.max(0, Math.min(pages.length - 1, i))) }} />}
        <div className="editor-tools">
          <button type="button" className="icon-button" aria-label="Previous annotation" title="Previous annotation: issue or warning" disabled={items.length === 0} onClick={() => step(-1)}>
            <CollapseIcon />
          </button>
          <span className="editor-page" title="Issues and warnings">
            Annotation {position < 0 ? "–" : position + 1}/{items.length}
          </span>
          <button type="button" className="icon-button" aria-label="Next annotation" title="Next annotation: issue or warning" disabled={items.length === 0} onClick={() => step(1)}>
            <ExpandIcon />
          </button>
        </div>
        </div>
        {showOriginal && <ModeToggle modes={MODES} mode={mode} onChange={switchMode} />}
        {showOriginal && <ZoomTools viewport={viewport} />}
        <Picker
          value={VIEWS.find((v) => v.value === view)!.label}
          label="What to show"
          groups={[VIEWS.map((v) => ({ label: v.label, onSelect: () => setView(v.value) }))]}
        />
        {(
          <div className="editor-tools editor-modes">
            <button
              type="button"
              className="editor-mode"
              aria-pressed={linked}
              aria-label={linked ? "Unlink the original and the transcription" : "Link the original and the transcription"}
              title={
                linked
                  ? "Linked: the original and the transcription follow each other, also when one of them is hidden. Click to unlink."
                  : "Unlinked: each stays where you leave it. Click to link them again."
              }
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
            ],
            ...(showOriginal ? [[{ label: "Add clarification", onSelect: () => { setSelected(null); switchMode("box"); } }]] : []),
          ]}
        />
      </div>
      {showOriginal && <p className="editor-hint">{hint}</p>}
      <div className="human-review-panes">
        {/* Kept in the page while hidden ("Transcription only"): its gestures and its place stay with it. */}
          <div className="page-editor" hidden={!showOriginal}>
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
                      const invalid = badBoxes.get(item.key)?.has(k) ?? false;
                      const label = `${labelOf(item)}${invalid ? " !" : ""}`;
                      const color = colors.get(item.key);
                      return (
                        <g
                          key={`${item.key}-${k}`}
                          stroke={color}
                          className={`review-box${item.kind === "warning" ? " warning" : ""}${item.key === selected ? " selected" : ""}${invalid ? " invalid" : ""}`}
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
                  {mode === "hand" &&
                    boxes === "shown" &&
                    selectedOwn &&
                    boxesOf({ kind: "issue", key: `issue-${selectedOwn.id}`, boxes: selectedOwn.boxes, issue: selectedOwn, own: true })
                      .filter((b) => b.page === page.page)
                      .map((b, k) => <BoxHandles key={k} box={b.box} size={{ width: W, height: H }} scale={s} />)}
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
            problem={boxProblems(selectedOwn.boxes, placed)}
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

const VIEWS = [
  { value: "both" as const, label: "Show both" },
  { value: "original" as const, label: "Original only" },
  { value: "transcription" as const, label: "Transcription only" },
];

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

// A clarification, the user's own issue: what the original score has in the places its boxes mark, the boxes (each
// removable), "Add a box", and "Delete clarification", which asks first. What keeps it from being finished is said in red.
function OwnIssuePanel({
  issue,
  color,
  systems,
  problem,
  onWrite,
  onRemoveBox,
  onAddBox,
  onDelete,
  onClose,
}: {
  issue: StoredIssue;
  color?: string;
  systems: PlacedSystem[];
  problem: { problem: string | null; bad: number[] };
  onWrite: (text: string) => void;
  onRemoveBox: (k: number) => void;
  onAddBox: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(issue.answers[0]?.text ?? "");
  const [deleting, setDeleting] = useState(false);
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
    const covered = systems.filter((s) => s.page === b.page && Math.min(b.box.bottom, s.layout.box.bottom) > Math.max(b.box.top, s.layout.box.top));
    return `page ${b.page}${covered.length ? `, system ${covered.map((s) => s.number).join(" and ")}` : ""}`;
  };
  return (
    <aside className="issue-panel" aria-label={`Clarification ${issue.id}`} style={{ borderTopColor: color }}>
      <div className="issue-panel-head">
        <p className="issue-head">#{issue.id} · [clarification]</p>
        <button type="button" className="icon-button" aria-label="Hide the clarification" title="Hide the clarification" onClick={onClose}>
          <ChevronDownIcon />
        </button>
      </div>
      <div className="own-correction">
        <span className="answer-own-label">
          <label htmlFor={`clarification-${issue.id}`}>What's in the original score?</label>
          <Info label="What to write">
            Explain what you see in the places marked by the boxes, where the models seem to be confused. Focus on what the
            original score shows, not on the mistakes you see in the transcription. For example, if the original has a C that
            was transcribed as a D, write “This is a C” rather than “The D is wrong”. That way, what you write still makes sense
            in later stages, once the mistake has been corrected.
          </Info>
        </span>
        <textarea
          id={`clarification-${issue.id}`}
          ref={field}
          rows={1}
          className="answer-other-field"
          value={text}
          placeholder="Clarification"
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
      </div>
      {!text.trim() && <p className="issue-facts hint-problem">{NO_TEXT}</p>}
      {problem.problem && <p className="issue-facts hint-problem">{problem.problem}</p>}
      <ul className="own-boxes">
        {issue.boxes.map((b, k) => (
          <li key={k} className={problem.bad.includes(k) ? "hint-problem" : undefined}>
            <span>
              Box {k + 1} · {where(b)}
            </span>
            <button type="button" className="button-secondary button-small" onClick={() => onRemoveBox(k)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="own-actions">
        <span className="own-add">
          <button type="button" className="button-secondary" onClick={onAddBox}>
            Add box
          </button>
          <Info label="The rules for boxes">
            Every clarification needs at least one box. Each box has to be on a system. The boxes can be on one system, or on
            two neighbouring systems. While you work on this stage, the rules are not enforced (what breaks a rule is just shown
            in red). To successfully finish the stage, however, all rules must be followed.
          </Info>
        </span>
        <button type="button" className="button-danger" onClick={() => setDeleting(true)}>
          Delete clarification
        </button>
      </div>
      {deleting && (
        <ConfirmDialog
          title="Are you sure?"
          text={[`Clarification ${issue.id} and its boxes will be deleted. This action cannot be undone.`]}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setDeleting(false);
            onDelete();
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </aside>
  );
}

// An "i" that shows its text below the line it is on, and hides it again (as a choice's reason does).
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="reason-toggle" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(!open)}>
        <InfoIcon />
      </button>
      {open && <span className="info-text">{children}</span>}
    </>
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
