// The editor of a WIP `fix_layout` stage (DESIGN.md §6): one page at a time, straightened as `layout` straightened
// it, with its system boxes and bar lines over it. Three tools, by a toggle. Hand: dragging pans, tapping selects a
// box (tapping again where boxes overlap goes through them; a label always selects its box) or one of the selected
// box's bar lines; the selected box's handles resize it and its bar lines can be dragged sideways. Box: tap, tap at
// two opposite corners. Bar line: a tap adds one in the system under it (the selected one, where boxes overlap). Systems are
// numbered top to bottom, continuing from page to page. Each change is saved at once; undo and redo per page.

import { DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION } from "@score3ly/imaging";
import type { LayoutSystem } from "@score3ly/prompts";
import { useEffect, useRef, useState } from "react";
import { fetchJsonContent, putContent, recordOutputs, type Project } from "./api";
import { layoutBytes } from "./finishFixLayout";
import {
  addBarLine,
  BOX_HANDLES,
  boxThrough,
  firstNumbers,
  fixedLayout,
  handlePoint,
  moveBarLine,
  resizeBox,
  sortSystems,
  systemAt,
  withinBox,
  type BoxHandle,
} from "./fixLayout";
import { canRedo, canUndo, pushState, redo, startHistory, undo, type History } from "./history";
import { BarLineIcon, BoxIcon, HandIcon, TrashIcon } from "./icons";
import type { PageLayout } from "./layout";
import {
  ModeToggle,
  PageCanvas,
  PageNav,
  undoKey,
  UndoRedo,
  usePageImage,
  useViewport,
  ZoomTools,
  type PageNavigation,
  type Point,
} from "./pageEditor";
import { straightPage } from "./pageImages";
import type { PageRecipe } from "./rasterize";

export type LayoutEditorPage = { page: number; recipe: PageRecipe; layoutSha256: string; item: string; parentId: string };

type Mode = "hand" | "box" | "bar";

const MODES = [
  { value: "hand" as const, label: "Hand", title: "Hand: pan, select boxes and bar lines, move edges and bar lines", icon: <HandIcon /> },
  { value: "box" as const, label: "Box", title: "Box: click or tap at two opposite corners of a system", icon: <BoxIcon /> },
  { value: "bar" as const, label: "Bar line", title: "Bar line: click or tap where a bar line goes", icon: <BarLineIcon /> },
];

// In screen px: a tap this close to a bar line selects it, this close to a handle grabs it.
const LINE_REACH = 14;
const HANDLE_REACH = 22;
// A label's size in screen px, per digit and fixed.
const LABEL = { height: 18, digit: 8, padding: 8 };

// Layouts saved on this device and not yet in the pipeline the app has, by stage and item.
const saved = new Map<string, PageLayout>();

export function LayoutEditor({
  project,
  stageId,
  pages,
  onEdited,
}: {
  project: Project;
  stageId: string;
  pages: LayoutEditorPage[];
  onEdited?: () => void; // a page was saved: the pipeline can be fetched again
}) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("hand");
  // Every page's layout, for the numbers that continue from page to page; the systems sorted.
  const [layouts, setLayouts] = useState<Map<string, PageLayout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Each page's changes while the editor is open, by item.
  const histories = useRef(new Map<string, History<LayoutSystem[]>>());
  const chain = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      pages.map(async (p) => {
        const layout = saved.get(`${stageId}/${p.item}`) ?? ((await fetchJsonContent(p.layoutSha256)) as PageLayout);
        return [p.item, { ...layout, systems: sortSystems(layout.systems) }] as const;
      }),
    ).then(
      (loaded) => {
        if (cancelled) return;
        for (const [item, layout] of loaded) {
          if (!histories.current.has(item)) histories.current.set(item, startHistory(layout.systems));
        }
        setLayouts(new Map(loaded));
      },
      () => !cancelled && setError("The layouts couldn't be loaded."),
    );
    return () => {
      cancelled = true;
    };
  }, [stageId]);

  // A page's systems from now on (a change, or a step back or forward): shown, and saved.
  function show(item: string, systems: LayoutSystem[]) {
    const page = pages.find((p) => p.item === item)!;
    const layout = fixedLayout({ ...layouts!.get(item)!, systems });
    setLayouts((current) => new Map(current).set(item, layout));
    saved.set(`${stageId}/${item}`, layout);
    chain.current = chain.current
      .then(async () => {
        const sha256 = await putContent(layoutBytes(layout), "application/json");
        await recordOutputs(project, stageId, [
          { item, type: "layout", contentSha256: sha256, parentOutputId: page.parentId, inputIds: [page.parentId] },
        ]);
        setError(null);
        onEdited?.();
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }

  const page = pages[Math.min(index, pages.length - 1)];
  const go = (i: number) => setIndex(Math.max(0, Math.min(pages.length - 1, i)));
  const firsts = layouts ? firstNumbers(pages.map((p) => layouts.get(p.item)?.systems.length ?? 0)) : [];
  const layout = layouts?.get(page.item);
  const history = histories.current.get(page.item);

  if (!layout || !history) {
    return <div className="page-placeholder">{error ?? "Loading the layouts…"}</div>;
  }
  return (
    <PageEditor
      key={page.item}
      page={page}
      layout={layout}
      first={firsts[Math.min(index, pages.length - 1)]}
      history={history}
      mode={mode}
      setMode={setMode}
      nav={{ index, count: pages.length, go }}
      error={error}
      change={(systems) => {
        histories.current.set(page.item, pushState(history, systems));
        show(page.item, systems);
      }}
      step={(move) => {
        const next = move(history);
        if (next === history) return false;
        histories.current.set(page.item, next);
        show(page.item, next.present);
        return true;
      }}
    />
  );
}

type Selection = { system: number; bar: number | null };
// What a pointer can take hold of: a handle of the selected box, or one of its bar lines.
type Grab = { kind: "box"; handle: BoxHandle } | { kind: "bar"; index: number };

function PageEditor({
  page,
  layout,
  first,
  history,
  mode,
  setMode,
  nav,
  error,
  change,
  step,
}: {
  page: LayoutEditorPage;
  layout: PageLayout;
  first: number; // the number of the page's first system
  history: History<LayoutSystem[]>;
  mode: Mode;
  setMode: (mode: Mode) => void;
  nav: PageNavigation;
  error: string | null;
  change: (systems: LayoutSystem[]) => void; // sorted
  step: (move: typeof undo) => boolean;
}) {
  const { image, error: imageError } = usePageImage(
    () => straightPage({ page: page.recipe, angle: layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION }),
    page.item,
  );
  // While something is dragged: the systems as they are, not yet a change.
  const [live, setLiveState] = useState<LayoutSystem[] | null>(null);
  const liveRef = useRef<LayoutSystem[] | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null); // box: the first corner, in image px
  const [hover, setHover] = useState<Point | null>(null); // with a mouse: where the pointer is
  const systems = live ?? layout.systems;

  const setLive = (next: LayoutSystem[] | null) => {
    liveRef.current = next;
    setLiveState(next);
  };

  const W = image?.width ?? 1;
  const H = image?.height ?? 1;
  const frac = (q: Point) => ({ x: q.x / W, y: q.y / H });

  // A change: the systems sorted, and the selection following its system (and bar line) to where they went.
  function commit(next: LayoutSystem[], select: { system: LayoutSystem; bar: number | null } | null) {
    const sorted = sortSystems(next);
    change(sorted);
    setSelected(select ? { system: sorted.indexOf(select.system), bar: select.bar } : null);
  }

  function replace(i: number, system: LayoutSystem): LayoutSystem[] {
    return systems.map((s, j) => (j === i ? system : s));
  }

  function deleteSelected() {
    if (!selected) return;
    const system = systems[selected.system];
    if (selected.bar !== null) {
      const next = { ...system, barLines: system.barLines.filter((_, j) => j !== selected.bar) };
      commit(replace(selected.system, next), { system: next, bar: null });
    } else {
      commit(
        systems.filter((_, j) => j !== selected.system),
        null,
      );
    }
  }

  function stepBack(move: typeof undo) {
    if (viewport.dragging()) return;
    if (anchor) {
      setAnchor(null);
      if (move === undo) return;
    }
    if (step(move)) setSelected(null);
  }

  // The label at a point, if any (the last drawn is on top).
  function labelAt(q: Point, scale: number): number | null {
    for (let i = systems.length - 1; i >= 0; i--) {
      const { left, top } = systems[i].box;
      const width = (String(first + i).length * LABEL.digit + LABEL.padding) / scale;
      const height = LABEL.height / scale;
      if (q.x >= left * W && q.x <= left * W + width && q.y >= top * H && q.y <= top * H + height) return i;
    }
    return null;
  }

  // One of the selected box's bar lines near a point.
  function barAt(q: Point, scale: number): number | null {
    if (!selected) return null;
    const { box, barLines } = systems[selected.system];
    if (q.y < box.top * H - LINE_REACH / scale || q.y > box.bottom * H + LINE_REACH / scale) return null;
    let best: number | null = null;
    let bestDist = LINE_REACH;
    barLines.forEach((x, j) => {
      const dist = Math.abs(x * W - q.x) * scale;
      if (dist < bestDist) {
        bestDist = dist;
        best = j;
      }
    });
    return best;
  }

  const viewport = useViewport<Grab>(image, {
    grab: (q, scale) => {
      if (mode !== "hand" || !selected) return null;
      const { box } = systems[selected.system];
      for (const handle of BOX_HANDLES) {
        const p = handlePoint(box, handle);
        if (Math.hypot(p.x * W - q.x, p.y * H - q.y) * scale < HANDLE_REACH) return { kind: "box", handle };
      }
      const bar = barAt(q, scale);
      return bar === null ? null : { kind: "bar", index: bar };
    },
    drag: (grabbed, q) => {
      if (!selected) return;
      const current = liveRef.current ?? layout.systems;
      const system = current[selected.system];
      if (grabbed.kind === "box") {
        setLive(current.map((s, j) => (j === selected.system ? { ...s, box: resizeBox(s.box, grabbed.handle, frac(q)) } : s)));
      } else {
        const moved = moveBarLine(system, grabbed.index, q.x / W);
        grabbed.index = moved.index; // passing a neighbour reorders them
        setLive(current.map((s, j) => (j === selected.system ? moved.system : s)));
        setSelected({ system: selected.system, bar: moved.index });
      }
    },
    release: (grabbed) => {
      const current = liveRef.current;
      setLive(null);
      if (!current || !selected) return;
      const system = grabbed.kind === "box" ? withinBox(current[selected.system]) : current[selected.system];
      commit(
        current.map((s, j) => (j === selected.system ? system : s)),
        { system, bar: grabbed.kind === "bar" ? grabbed.index : null },
      );
    },
    tap: (q, scale) => {
      if (!image) return;
      if (mode === "hand") {
        const label = labelAt(q, scale);
        if (label !== null) return setSelected({ system: label, bar: null });
        const bar = barAt(q, scale);
        if (bar !== null && selected) return setSelected({ system: selected.system, bar });
        const system = systemAt(systems, frac(q), selected?.system ?? null);
        return setSelected(system === null ? null : { system, bar: null });
      }
      if (mode === "box") {
        if (!anchor) return setAnchor(q);
        // A box too small to be a system (a slip) is ignored: the corner waits for another tap.
        const box = boxThrough(frac(anchor), frac(q));
        if (!box) return;
        setAnchor(null);
        const system = { box, barLines: [] };
        return commit([...systems, system], { system, bar: null });
      }
      // Bar line: in the system under the tap, the selected one if it is (boxes may overlap).
      const p = frac(q);
      const under = systems.flatMap((sys, j) =>
        p.x >= sys.box.left && p.x <= sys.box.right && p.y >= sys.box.top && p.y <= sys.box.bottom ? [j] : [],
      );
      const i = selected && under.includes(selected.system) ? selected.system : (under[0] ?? null);
      if (i === null) return;
      const added = addBarLine(systems[i], p.x);
      commit(replace(i, added.system), { system: added.system, bar: added.index });
    },
    hover: (q) => setHover(mode === "box" ? q : null),
  });

  function onKeyDown(event: React.KeyboardEvent) {
    if (undoKey(event, () => stepBack(undo), () => stepBack(redo))) return;
    const bar = selected?.bar ?? null;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "Escape") {
      setAnchor(null);
      setSelected(null);
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && selected && bar !== null) {
      // Nudges the selected bar line by a pixel, ten with Shift.
      event.preventDefault();
      const px = (event.shiftKey ? 10 : 1) * (event.key === "ArrowLeft" ? -1 : 1);
      const system = systems[selected.system];
      const moved = moveBarLine(system, bar, system.barLines[bar] + px / W);
      commit(replace(selected.system, moved.system), { system: moved.system, bar: moved.index });
    } else if (event.key === "ArrowLeft" && nav.index > 0) {
      nav.go(nav.index - 1);
    } else if (event.key === "ArrowRight" && nav.index < nav.count - 1) {
      nav.go(nav.index + 1);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setAnchor(null);
    setHover(null);
    // The selection stays for the bar line tool: it says where new bar lines go.
    if (next === "box") setSelected(null);
  }

  const s = viewport.scale;
  const rubber = anchor && hover ? boxThrough(frac(anchor), frac(hover)) : null;

  return (
    <div className="page-editor" onKeyDown={onKeyDown}>
      {/* After a button, the keys still go to the editor (a disabled button would leave the focus nowhere). */}
      <div className="editor-toolbar" onClick={viewport.focus}>
        <PageNav nav={nav} />
        <ModeToggle modes={MODES} mode={mode} onChange={switchMode} />
        <ZoomTools viewport={viewport}>
          <button
            type="button"
            className="icon-button"
            aria-label={selected?.bar != null ? "Delete bar line" : "Delete system"}
            title="Delete the selected bar line, or the selected system"
            disabled={selected === null}
            onClick={deleteSelected}
          >
            <TrashIcon />
          </button>
        </ZoomTools>
        <UndoRedo
          canUndo={anchor !== null || canUndo(history)}
          canRedo={canRedo(history)}
          onUndo={() => stepBack(undo)}
          onRedo={() => stepBack(redo)}
        />
      </div>

      <PageCanvas
        viewport={viewport}
        image={image}
        className={mode}
        label={`Page ${page.page}: system boxes and bar lines`}
        error={imageError ?? error}
      >
        {image && (
          <>
            {systems.map((system, i) => {
              const color = LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length];
              const { left, right, top, bottom } = system.box;
              const isSelected = selected?.system === i;
              const label = String(first + i);
              return (
                <g
                  key={i}
                  stroke={color}
                  className={isSelected ? "layout-box selected" : selected ? "layout-box dimmed" : "layout-box"}
                >
                  <rect x={left * W} y={top * H} width={(right - left) * W} height={(bottom - top) * H} fill="none" />
                  {system.barLines.map((x, j) => (
                    <line
                      key={j}
                      className={isSelected && selected?.bar === j ? "layout-bar selected" : "layout-bar"}
                      x1={x * W}
                      x2={x * W}
                      y1={top * H}
                      y2={bottom * H}
                    />
                  ))}
                  <rect
                    className="layout-label"
                    x={left * W}
                    y={top * H}
                    width={(label.length * LABEL.digit + LABEL.padding) / s}
                    height={LABEL.height / s}
                    fill={color}
                  />
                  <text
                    className="layout-label-text"
                    x={left * W + LABEL.padding / 2 / s}
                    y={top * H + (LABEL.height - 5) / s}
                    fontSize={13 / s}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {selected &&
              systems[selected.system] &&
              BOX_HANDLES.map((handle, k) => {
                const p = handlePoint(systems[selected.system].box, handle);
                return (
                  <rect
                    key={k}
                    className="editor-handle"
                    x={p.x * W - 7 / s}
                    y={p.y * H - 7 / s}
                    width={14 / s}
                    height={14 / s}
                    strokeWidth={2 / s}
                  />
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
            {anchor && <circle className="editor-anchor" cx={anchor.x} cy={anchor.y} r={5 / s} />}
          </>
        )}
      </PageCanvas>
    </div>
  );
}
