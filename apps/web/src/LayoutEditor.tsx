// The editor of a WIP `fix_layout` stage (docs/stages/layout.md): one page at a time, straightened as `layout` straightened
// it, with its system boxes and bar lines over it. Three tools, by a toggle. Hand: dragging pans, tapping selects a
// box (tapping again where boxes overlap goes through them; a label always selects its box) or one of the selected
// box's bar lines; the selected box's handles resize it and its bar lines can be dragged sideways. Box: tap, tap at
// two opposite corners. Bar line: a tap adds one in the system under it (the selected one, where boxes overlap). Systems are
// numbered top to bottom, continuing from page to page. Each change is saved at once; undo and redo per page.

import { DEVICE_KEYS, useRemembered } from "./deviceStorage";
import type { LayoutSystem } from "@score3ly/core";
import { useEffect, useRef, useState } from "react";
import { fetchJsonContent, putJson, recordOutputs, type Project } from "./api";
import { addBarLine, fixedLayout, moveBarLine, settledBarLine, sortSystems, systemAt, withinBox } from "./fixLayout";
import { boxThrough, resizeBox, type BoxHandle } from "./editor/boxEdit";
import { canRedo, canUndo, redo, undo, type UndoStack } from "./history";
import { BarLineIcon, BoxIcon, HandIcon, TrashIcon } from "./ui/icons";
import { firstNumbers, type PageLayout } from "./layout";
import {
  BoxHandles,
  editorKeys,
  LineHandle,
  ModeToggle,
  ShowToggle,
  PageCanvas,
  PageNav,
  UndoRedo,
  UnsavedNote,
  usePageEditorShell,
  usePageImage,
  useViewport,
  ZoomTools,
  type EditorPage,
  type PageNavigation,
  type Point,
} from "./editor/pageEditor";
import { handleAt, LINE_REACH } from "./editor/handles";
import { LABEL, labelWidth, LayoutMarks } from "./editor/marks";
import { ImagesDiffer } from "./ImagesDiffer";
import { keepFingerprintOnce, straightPage } from "./pageImages";
import { straightImageRecipe, straightRecipe } from "./recipes";

type Mode = "hand" | "box" | "bar";

const MODES = [
  { value: "hand" as const, label: "Hand", title: "Hand: pan, select boxes and bar lines, move edges and bar lines", icon: <HandIcon /> },
  { value: "box" as const, label: "Box", title: "Box: click or tap at two opposite corners of a system", icon: <BoxIcon /> },
  { value: "bar" as const, label: "Bar line", title: "Bar line: click or tap where a bar line goes", icon: <BarLineIcon /> },
];


export function LayoutEditor({
  project,
  stageId,
  pages,
  onEdited,
}: {
  project: Project;
  stageId: string;
  pages: EditorPage[]; // their content: the layouts
  onEdited?: () => void; // a page was saved: the pipeline can be fetched again
}) {
  // The stage's saver (saving.ts): what it saved is shown when the editor opens again.
  const shell = usePageEditorShell<LayoutSystem[], Mode>(pages, stageId, onEdited, "hand");
  const { saver } = shell;
  // Every page's layout, for the numbers that continue from page to page; the systems sorted.
  const [layouts, setLayouts] = useState<Map<string, PageLayout> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      pages.map(async (p) => {
        const layout = saver.value<PageLayout>(p.item) ?? ((await fetchJsonContent(p.contentSha256)) as PageLayout);
        return [p.item, { ...layout, systems: sortSystems(layout.systems) }] as const;
      }),
    ).then(
      (loaded) => {
        if (cancelled) return;
        for (const [item, layout] of loaded) shell.startHistory(item, layout.systems);
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
    saver.save(item, layout, async () => {
      const sha256 = await putJson(layout);
      await recordOutputs(project, stageId, [
        { item, type: "layout", contentSha256: sha256, parentOutputId: page.parentId, inputIds: [page.parentId] },
      ]);
      // The boxes are drawn on this image: its fingerprint is kept (§8.3), once per session, apart from the save.
      const straight = straightRecipe(page.recipe, layout.angle);
      void keepFingerprintOnce(straightImageRecipe(straight), () => straightPage(straight));
    });
  }

  const { page } = shell;
  const firsts = layouts ? firstNumbers(pages.map((p) => ({ page: p.page, systems: layouts.get(p.item)?.systems ?? [] }))) : [];
  const layout = layouts?.get(page.item);
  const history = shell.history(page.item);

  if (!layout || !history) {
    return <div className="page-placeholder error-text">{error ?? "Loading the layouts…"}</div>;
  }
  return (
    <PageEditor
      key={page.item}
      page={page}
      layout={layout}
      first={firsts[shell.at]}
      history={history}
      mode={shell.mode}
      setMode={shell.setMode}
      nav={shell.nav}
      error={error}
      unsaved={<UnsavedNote className="editor-error error-text" state={saver.state} onRetry={saver.retry} />}
      change={(systems) => {
        if (shell.push(page.item, systems)) show(page.item, systems);
      }}
      step={(move) => {
        const present = shell.step(page.item, move);
        if (present === null) return false;
        show(page.item, present);
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
  unsaved,
  change,
  step,
}: {
  page: EditorPage;
  layout: PageLayout;
  first: number; // the number of the page's first system
  history: UndoStack<LayoutSystem[]>;
  mode: Mode;
  setMode: (mode: Mode) => void;
  nav: PageNavigation;
  error: string | null;
  unsaved: React.ReactNode; // an edit not saved, over the page
  change: (systems: LayoutSystem[]) => void; // sorted
  step: (move: typeof undo) => boolean;
}) {
  const [marks, setMarks] = useRemembered<"shown" | "hidden">(DEVICE_KEYS.fixLayoutMarks, "shown", ["shown", "hidden"]);
  const hidden = marks === "hidden";
  const { image, error: imageError } = usePageImage(
    () => straightPage(straightRecipe(page.recipe, layout.angle)),
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
      const width = labelWidth(String(first + i), scale);
      const height = LABEL.height / scale;
      if (q.x >= left * W && q.x <= left * W + width && q.y >= top * H && q.y <= top * H + height) return i;
    }
    return null;
  }

  // The bar line nearest a point, of any system (decided 2026-11-12: one tap selects a bar line, without selecting its
  // box first); the selected system's first where boxes overlap.
  function barAt(q: Point, scale: number): { system: number; bar: number } | null {
    const order = systems.map((_, i) => i).sort((a, b) => Number(b === selected?.system) - Number(a === selected?.system));
    let best: { system: number; bar: number } | null = null;
    let bestDist = LINE_REACH;
    for (const i of order) {
      const { box, barLines } = systems[i];
      if (q.y < box.top * H - LINE_REACH / scale || q.y > box.bottom * H + LINE_REACH / scale) continue;
      barLines.forEach((x, j) => {
        const dist = Math.abs(x * W - q.x) * scale;
        if (dist < bestDist) {
          bestDist = dist;
          best = { system: i, bar: j };
        }
      });
    }
    return best;
  }

  const viewport = useViewport<Grab>(image, {
    // A selected bar line is dragged by itself (or its handle); a selected box by its handles.
    grab: (q, scale) => {
      if (hidden || mode !== "hand" || !selected) return null;
      if (selected.bar !== null) {
        const { box, barLines } = systems[selected.system];
        const near = Math.abs(barLines[selected.bar] * W - q.x) * scale < LINE_REACH && q.y >= box.top * H - LINE_REACH / scale && q.y <= box.bottom * H + LINE_REACH / scale;
        return near ? { kind: "bar", index: selected.bar } : null;
      }
      const handle = handleAt(systems[selected.system].box, q, { width: W, height: H }, scale);
      return handle ? { kind: "box", handle } : null;
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
      // Let go: lines the box no longer covers dropped, a line let go at another's place merged with it (B3).
      const live = current[selected.system];
      const settled = grabbed.kind === "box" ? { system: withinBox(live), index: null } : settledBarLine(live, live.barLines[grabbed.index]);
      commit(
        current.map((s, j) => (j === selected.system ? settled.system : s)),
        { system: settled.system, bar: settled.index },
      );
    },
    tap: (q, scale) => {
      if (!image || hidden) return;
      if (mode === "hand") {
        const label = labelAt(q, scale);
        if (label !== null) return setSelected({ system: label, bar: null });
        const bar = barAt(q, scale);
        if (bar) return setSelected(bar);
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
      // A tap on a line selects it; a box too narrow for one takes none.
      if (added.system === systems[i]) return setSelected({ system: i, bar: added.index });
      commit(replace(i, added.system), { system: added.system, bar: added.index });
    },
    hover: (q) => setHover(mode === "box" ? q : null),
  });

  function onKeyDown(event: React.KeyboardEvent) {
    const bar = selected?.bar ?? null;
    editorKeys(event, {
      undo: () => stepBack(undo),
      redo: () => stepBack(redo),
      remove: deleteSelected,
      escape: () => {
        setAnchor(null);
        setSelected(null);
      },
      nav,
      // Nudges the selected bar line by a pixel, ten with Shift.
      arrow: (event) => {
        if (!((event.key === "ArrowLeft" || event.key === "ArrowRight") && selected && bar !== null)) return false;
        event.preventDefault();
        const px = (event.shiftKey ? 10 : 1) * (event.key === "ArrowLeft" ? -1 : 1);
        const system = systems[selected.system];
        const moved = moveBarLine(system, bar, system.barLines[bar] + px / W);
        const settled = settledBarLine(moved.system, moved.system.barLines[moved.index]);
        commit(replace(selected.system, settled.system), { system: settled.system, bar: settled.index });
        return true;
      },
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setAnchor(null);
    setHover(null);
    // The selection stays for the bar line tool: it says where new bar lines go.
    if (next === "box") setSelected(null);
  }

  function showMarks(shown: boolean) {
    setMarks(shown ? "shown" : "hidden");
    if (!shown) {
      switchMode("hand");
      setSelected(null);
    }
  }

  const s = viewport.scale;
  const rubber = anchor && hover ? boxThrough(frac(anchor), frac(hover)) : null;

  return (
    <div className="page-editor" onKeyDown={onKeyDown}>
      {/* After a button, the keys still go to the editor (a disabled button would leave the focus nowhere). */}
      <div className="editor-toolbar page-editor-toolbar layout-editor-toolbar" onClick={viewport.focus}>
        <PageNav nav={nav} />
        <ModeToggle modes={MODES} mode={mode} onChange={switchMode} enabled={(m) => !hidden || m === "hand"} />
        <ShowToggle shown={!hidden} onChange={showMarks} what="boxes and bar lines" />
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
      <p className="editor-hint">Boxes tight around each system. Bar lines only inside a system, not at its start or end.</p>

      <PageCanvas
        viewport={viewport}
        image={image}
        className={mode}
        label={`Page ${page.page}: system boxes and bar lines`}
        error={imageError ?? error}
        unsaved={unsaved}
        notice={<ImagesDiffer page={page.recipe} />}
      >
        {/* Hidden: an empty drawing, so that the page itself still shows (PageCanvas waits for a drawing). */}
        {image && (hidden ? (
          <g />
        ) : (
          <>
            <LayoutMarks systems={systems} first={first} size={{ width: W, height: H }} scale={s} selected={selected?.system ?? null} />
            {selected && systems[selected.system] && selected.bar === null && <BoxHandles box={systems[selected.system].box} size={{ width: W, height: H }} scale={s} />}
            {selected && systems[selected.system] && selected.bar !== null && systems[selected.system].barLines[selected.bar] !== undefined && (
              <LineHandle
                x={systems[selected.system].barLines[selected.bar] * W}
                top={systems[selected.system].box.top * H}
                bottom={systems[selected.system].box.bottom * H}
                scale={s}
              />
            )}
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
        ))}
      </PageCanvas>
    </div>
  );
}
