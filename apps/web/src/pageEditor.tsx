// What the editors of manual stages share (docs/stages/layout.md): a page that is zoomed and
// panned by hand, the gestures on it, the parts of the toolbar, and saving each change.
//
// Gestures: two fingers always pan and zoom; so do Ctrl + wheel and the buttons. One finger (or the mouse) either
// taps, drags something the editor lets it grab (a handle), or pans. Never press and drag to create anything: on a
// phone the user zooms in close for each point and zooms out and pans in between.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CollapseIcon, ExpandIcon, FitWidthIcon, RedoIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from "./icons";
import { pngSize } from "./pageImages";
import { BOX_HANDLES } from "./fixLayout";
import { CORNER, EDGE, EDGE_SHARE, handleRect } from "./handles";
export { handleAt } from "./handles";
import type { Box } from "@score3ly/notation";

export type Point = { x: number; y: number };
import { clampView, PAD, wholePageScale, type View } from "./viewBounds";

// A pointer that moves less than this between down and up tapped; more, it dragged.
const TAP_SLOP = { mouse: 4, touch: 10 };
const MAX_SCALE = 8;


// What the editor does with the gestures. Points are in image px; `scale` turns image px into screen px.
export type Interaction<G> = {
  grab?: (p: Point, scale: number) => G | null; // what a pointer going down here takes hold of, if anything
  drag?: (grabbed: G, p: Point) => void;
  release?: (grabbed: G) => void; // the drag ended (also when a second finger comes and it becomes a pinch)
  tap?: (p: Point, scale: number) => void;
  hover?: (p: Point | null) => void; // a mouse moving over the page, without a button
};

type Gesture<G> =
  | { kind: "none" }
  // One pointer down, not yet known whether it taps or drags.
  | { kind: "pending"; id: number; start: Point; last: Point; grabbed: G | null }
  | { kind: "pan"; id: number; last: Point }
  | { kind: "drag"; id: number; grabbed: G }
  | { kind: "pinch"; mid: Point; dist: number }
  // A finger left over from a pinch: does nothing until it lifts.
  | { kind: "idle" };

// The zoomed and panned page: the viewport's element gets `ref` and `handlers`, the content `transform`.
export function useViewport<G>(image: { width: number; height: number } | null, interaction: Interaction<G>) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture<G>>({ kind: "none" });
  // The scale at which the whole page is in view: the furthest one can zoom out.
  const pageScale = useRef(1);
  // Whether the page is fitted to the width and not zoomed since: it then stays fitted when the view changes size (a
  // pane beside it shown or hidden).
  const widthFitted = useRef(false);
  // The latest image: the listeners registered once (the wheel, the size) read it here.
  const imageRef = useRef(image);
  imageRef.current = image;
  // The latest handlers: they close over the editor's state of this render.
  const latest = useRef(interaction);
  latest.current = interaction;

  // Every view goes through here: the page can't be panned further than PAD past its edges, and where it is smaller
  // than the view in a direction, it is centred in that direction.
  // `fitted`: whether the new view is fitted to the width; by default, it stays so while the scale doesn't change (a pan).
  const setView = (next: View, fitted?: boolean) => {
    widthFitted.current = fitted ?? (widthFitted.current && next.scale === viewRef.current.scale);
    const clamped = clampView(next, ref.current, imageRef.current);
    viewRef.current = clamped;
    setViewState(clamped);
  };

  // The whole page in view, centred.
  function fitPage() {
    const el = ref.current;
    if (!el || !image) return;
    pageScale.current = wholePageScale(el, image);
    setView({ scale: pageScale.current, x: 0, y: 0 });
  }
  // The page's width in view, from its top: how a page opens (decided 2026-11-12, the project owner).
  function fitWidth() {
    const el = ref.current;
    if (!el || !image) return;
    pageScale.current = wholePageScale(el, image);
    setView({ scale: widthScale(el, image), x: PAD, y: PAD }, true);
  }
  function widthScale(el: HTMLElement, image: { width: number; height: number }) {
    return Math.max(pageScale.current, (el.clientWidth - 2 * PAD) / image.width);
  }
  // What to show once the image is there (`show`, `center`): a later image (another page) waits for it.
  const pending = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    fitWidth();
    const then = pending.current;
    pending.current = null;
    then?.();
  }, [image]);

  // A point of the image (in image px) in the middle of the view; at `scale` if given, else at the scale it has.
  function center(p: Point, scale?: number) {
    const el = ref.current;
    if (!el || !image) {
      pending.current = () => center(p, scale);
      return;
    }
    const k = scale ?? viewRef.current.scale;
    setView({ scale: k, x: el.clientWidth / 2 - p.x * k, y: el.clientHeight / 2 - p.y * k });
  }

  // A rectangle of the image (in image px) in the middle of the view, with room around it for context, at most 1.5
  // times the image's own size and never smaller than the whole page; a later image (another page) waits for it.
  function show(rect: { left: number; top: number; right: number; bottom: number }) {
    const el = ref.current;
    if (!el || !image) {
      pending.current = () => show(rect);
      return;
    }
    const w = Math.max(1, rect.right - rect.left);
    const h = Math.max(1, rect.bottom - rect.top);
    const scale = Math.max(pageScale.current, Math.min(1.5, (el.clientWidth * 0.5) / w, (el.clientHeight * 0.4) / h));
    setView({ scale, x: el.clientWidth / 2 - ((rect.left + rect.right) / 2) * scale, y: el.clientHeight / 2 - ((rect.top + rect.bottom) / 2) * scale });
  }

  // Zooms by `factor` around a point of the viewport, which stays where it is.
  function zoomAt(at: Point, factor: number) {
    const v = viewRef.current;
    const scale = Math.max(pageScale.current, Math.min(MAX_SCALE, v.scale * factor));
    const k = scale / v.scale;
    setView({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k });
  }

  function panBy(dx: number, dy: number) {
    const v = viewRef.current;
    setView({ ...v, x: v.x + dx, y: v.y + dy });
  }

  function zoomBy(factor: number) {
    const el = ref.current;
    if (el) zoomAt({ x: el.clientWidth / 2, y: el.clientHeight / 2 }, factor);
  }

  function local(event: { clientX: number; clientY: number }): Point {
    const rect = ref.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function toImage(p: Point): Point {
    const v = viewRef.current;
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
  }

  // The view's size changing (a pane beside it shown or hidden, the window resized): what was in its middle stays there,
  // so a page that was centred stays centred.
  useEffect(() => {
    const el = ref.current!;
    let size = { w: el.clientWidth, h: el.clientHeight };
    const observer = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      const image = imageRef.current;
      if (image && next.w && next.h) pageScale.current = wholePageScale(el, image);
      if (image && next.w && next.h && widthFitted.current) {
        // Still fitted to the width, at the same place down the page.
        const v = viewRef.current;
        const scale = widthScale(el, image);
        setView({ scale, x: PAD, y: v.y * (scale / v.scale) }, true);
      } else if (size.w && size.h && next.w && next.h && (next.w !== size.w || next.h !== size.h)) panBy((next.w - size.w) / 2, (next.h - size.h) / 2);
      size = next;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ctrl + wheel (and a trackpad's pinch) zooms; the wheel alone pans. The listener can't be passive.
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
      // At most about 1.6 times per event: a wheel's notch sends 100 or more, a trackpad's pinch a few at a time.
      if (event.ctrlKey) zoomAt(local(event), Math.exp(-Math.max(-50, Math.min(50, event.deltaY * unit)) * 0.01));
      else panBy(-event.deltaX * unit, -event.deltaY * unit);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    try {
      ref.current!.setPointerCapture(event.pointerId);
    } catch {
      // Not a pointer the browser knows (synthetic): it still works, without capture.
    }
    ref.current!.focus({ preventScroll: true });
    const p = local(event);
    pointers.current.set(event.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 2) {
      // Something being dragged stays where it got to.
      if (g.kind === "drag") latest.current.release?.(g.grabbed);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", mid: midpoint(a, b), dist: Math.hypot(a.x - b.x, a.y - b.y) };
    } else if (pointers.current.size === 1) {
      const grabbed = latest.current.grab?.(toImage(p), viewRef.current.scale) ?? null;
      gesture.current = { kind: "pending", id: event.pointerId, start: p, last: p, grabbed };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const p = local(event);
    if (event.pointerType === "mouse") latest.current.hover?.(toImage(p));
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, p);
    const g = gesture.current;
    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      const mid = midpoint(a, b);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.dist > 0) zoomAt(g.mid, dist / g.dist);
      panBy(mid.x - g.mid.x, mid.y - g.mid.y);
      gesture.current = { kind: "pinch", mid, dist };
    } else if (g.kind === "pending" && g.id === event.pointerId) {
      const slop = event.pointerType === "mouse" ? TAP_SLOP.mouse : TAP_SLOP.touch;
      if (Math.hypot(p.x - g.start.x, p.y - g.start.y) < slop) return;
      if (g.grabbed !== null) {
        gesture.current = { kind: "drag", id: g.id, grabbed: g.grabbed };
        latest.current.drag?.(g.grabbed, toImage(p));
      } else {
        gesture.current = { kind: "pan", id: g.id, last: p };
        panBy(p.x - g.last.x, p.y - g.last.y);
      }
    } else if (g.kind === "pan" && g.id === event.pointerId) {
      panBy(p.x - g.last.x, p.y - g.last.y);
      gesture.current = { ...g, last: p };
    } else if (g.kind === "drag" && g.id === event.pointerId) {
      latest.current.drag?.(g.grabbed, toImage(p));
    }
  }

  function onPointerUp(event: React.PointerEvent, cancelled = false) {
    if (!pointers.current.delete(event.pointerId)) return;
    const g = gesture.current;
    if (g.kind === "pinch") {
      gesture.current = pointers.current.size > 0 ? { kind: "idle" } : { kind: "none" };
      return;
    }
    if (pointers.current.size === 0) gesture.current = { kind: "none" };
    if (g.kind === "pending" && g.id === event.pointerId && !cancelled) {
      latest.current.tap?.(toImage(local(event)), viewRef.current.scale);
    }
    if (g.kind === "drag" && g.id === event.pointerId) latest.current.release?.(g.grabbed);
  }

  return {
    ref,
    scale: view.scale,
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    fit: fitPage,
    fitWidth,
    show,
    center,
    zoomBy,
    view, // screen px per image px, and where the image's corner is
    // The point of the image (in image px) in the middle of the view, if the view has a size.
    middle: (): Point | null => {
      const el = ref.current;
      if (!el || !el.clientWidth) return null;
      const v = viewRef.current;
      return { x: (el.clientWidth / 2 - v.x) / v.scale, y: (el.clientHeight / 2 - v.y) / v.scale };
    },
    focus: () => ref.current?.focus({ preventScroll: true }),
    dragging: () => gesture.current.kind === "drag",
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent) => onPointerUp(e),
      onPointerCancel: (e: React.PointerEvent) => onPointerUp(e, true),
      onPointerLeave: () => latest.current.hover?.(null),
    },
  };
}

export type Viewport = ReturnType<typeof useViewport>;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// A PNG made for the page (e.g. the page image, or the page straightened), with its size, as an object URL.
export function usePageImage(load: () => Promise<Blob>, key: string) {
  const [image, setImage] = useState<{ url: string; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    load()
      .then(async (png) => {
        const size = await pngSize(png);
        if (cancelled) return;
        url = URL.createObjectURL(png);
        setImage({ url, ...size });
      })
      .catch((err) => !cancelled && setError(`This page can't be drawn: ${err instanceof Error ? err.message : err}`));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);
  return { image, error };
}

// Saving a page's state as soon as it changes, one save after the other, so the last change is the one stored.
// `cache` keeps what was saved on this device until the pipeline is fetched again (the editor may be closed and
// opened again before that).
export function useSaver<T>(cache: Map<string, T>, key: string, store: (value: T) => Promise<void>, onSaved?: () => void) {
  const chain = useRef(Promise.resolve());
  const [error, setError] = useState<string | null>(null);
  function save(value: T) {
    cache.set(key, value);
    chain.current = chain.current
      .then(async () => {
        await store(value);
        setError(null);
        onSaved?.();
      })
      .catch((err) => setError(`Saving failed: ${err instanceof Error ? err.message : err}`));
  }
  return { save, error };
}

// The viewport's element and the page in it, with the editor's drawing over the image. `--px` is one screen pixel
// in the drawing's units: the content is scaled by CSS, which scales strokes too.
export function PageCanvas({
  viewport,
  image,
  className,
  label,
  error,
  notice,
  children,
}: {
  viewport: Viewport;
  image: { url: string; width: number; height: number } | null;
  className: string;
  label: string;
  error: string | null;
  notice?: ReactNode; // over the page, e.g. that the image differs (ImagesDiffer.tsx)
  children: ReactNode; // the drawing: SVG elements in image px; shown once there is an image
}) {
  return (
    <div ref={viewport.ref} className={`editor-viewport ${className}`} tabIndex={0} aria-label={label} {...viewport.handlers}>
      {image && children ? (
        <div className="editor-content" style={{ width: image.width, height: image.height, transform: viewport.transform }}>
          <img src={image.url} alt="" draggable={false} />
          <svg
            viewBox={`0 0 ${image.width} ${image.height}`}
            width={image.width}
            height={image.height}
            style={{ "--px": `${1 / viewport.scale}px` } as React.CSSProperties}
            aria-hidden="true"
          >
            {children}
          </svg>
        </div>
      ) : (
        <div className="page-placeholder">{error ?? "Drawing the page…"}</div>
      )}
      {error && image && <p className="editor-error error-text">{error}</p>}
      {image && notice}
    </div>
  );
}

// The toolbar's parts.

export type PageNavigation = { index: number; count: number; go: (i: number) => void };

export function PageNav({ nav }: { nav: PageNavigation }) {
  return (
    <div className="editor-tools">
      <button type="button" className="icon-button" aria-label="Previous page" disabled={nav.index === 0} onClick={() => nav.go(nav.index - 1)}>
        <CollapseIcon />
      </button>
      <span className="editor-page">
        Page {nav.index + 1}/{nav.count}
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label="Next page"
        disabled={nav.index === nav.count - 1}
        onClick={() => nav.go(nav.index + 1)}
      >
        <ExpandIcon />
      </button>
    </div>
  );
}

// The editor's modes (tools), icons only.
export function ModeToggle<M extends string>({
  modes,
  mode,
  onChange,
}: {
  modes: { value: M; label: string; title: string; icon: ReactNode }[];
  mode: M;
  onChange: (mode: M) => void;
}) {
  return (
    <div className="editor-tools editor-modes" role="radiogroup" aria-label="Mode">
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          className="editor-mode"
          aria-label={m.label}
          title={m.title}
          onClick={() => onChange(m.value)}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

// Zoom out, zoom in, fit the page's width; then whatever the editor adds (e.g. Delete).
export function ZoomTools({ viewport, children }: { viewport: Viewport; children?: ReactNode }) {
  return (
    <div className="editor-tools">
      <button type="button" className="icon-button zoom-step" aria-label="Zoom out" onClick={() => viewport.zoomBy(1 / 1.5)}>
        <ZoomOutIcon />
      </button>
      <button type="button" className="icon-button zoom-step" aria-label="Zoom in" onClick={() => viewport.zoomBy(1.5)}>
        <ZoomInIcon />
      </button>
      <button type="button" className="icon-button zoom-fit" aria-label="Fit width" onClick={viewport.fitWidth}>
        <FitWidthIcon />
      </button>
      {children}
    </div>
  );
}

export function UndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="editor-tools">
      <button type="button" className="icon-button" aria-label="Undo" title="Undo" disabled={!canUndo} onClick={onUndo}>
        <UndoIcon />
      </button>
      <button type="button" className="icon-button" aria-label="Redo" title="Redo" disabled={!canRedo} onClick={onRedo}>
        <RedoIcon />
      </button>
    </div>
  );
}

// Ctrl or Cmd + Z undoes; with Shift, or Ctrl + Y, it redoes. Returns whether the key was one of them.
export function undoKey(event: React.KeyboardEvent, onUndo: () => void, onRedo: () => void): boolean {
  const key = event.key.toLowerCase();
  if (!(event.ctrlKey || event.metaKey) || (key !== "z" && key !== "y")) return false;
  event.preventDefault();
  if (key === "y" || event.shiftKey) onRedo();
  else onUndo();
  return true;
}

// A box's handles, drawn in the editor's SVG (image px), the same size on screen at any zoom; their border one screen pixel,
// thinner than the boxes', so they don't read as boxes themselves.
export function BoxHandles({ box, size, scale }: { box: Box; size: { width: number; height: number }; scale: number }) {
  return (
    <>
      {BOX_HANDLES.map((handle, k) => (
        <rect key={k} className="editor-handle" {...handleRect(box, handle, size, scale)} strokeWidth={1 / scale} />
      ))}
    </>
  );
}

// The handle of a vertical line inside a box (a bar line in `fix_layout`), like an edge's: a bar along it, centred.
export function LineHandle({ x, top, bottom, scale }: { x: number; top: number; bottom: number; scale: number }) {
  const length = Math.max(CORNER / scale, (bottom - top) * EDGE_SHARE);
  return <rect className="editor-handle" x={x - EDGE / 2 / scale} y={(top + bottom) / 2 - length / 2} width={EDGE / scale} height={length} strokeWidth={1 / scale} />;
}
