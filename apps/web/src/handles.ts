// The geometry of the page editors' handles (pageEditor.tsx draws them): where each is, and which one a pointer
// takes hold of. Apart, so that the tests can import it without React.

import { BOX_HANDLES, handlePoint, type Box, type BoxHandle } from "./fixLayout.ts";

type Point = { x: number; y: number };

// The handles of a box being resized (docs/stages/layout.md, `fix_layout`; also one's own issues in a human review):
// a corner moves two edges, the middle of an edge one. Corners are squares; an edge's handle is a long bar along it,
// over most of the edge (decided 2026-11-12, the project owner: easier to hit than a square). In screen px: a corner
// square's side, an edge handle's thickness, and how close a pointer has to be to grab one.
export const CORNER = 14;
export const EDGE = 10;
const HANDLE_REACH = 22;
// The share of its edge an edge handle covers, centred on the edge.
export const EDGE_SHARE = 0.6;

// Where a handle is drawn, in image px: a square on a corner, a bar along an edge. At least a corner's size on screen,
// so a small box's edge handles stay visible.
export function handleRect(box: Box, handle: BoxHandle, size: { width: number; height: number }, scale: number) {
  const p = handlePoint(box, handle);
  const cx = p.x * size.width;
  const cy = p.y * size.height;
  const along = (extent: number) => Math.max(CORNER / scale, extent * EDGE_SHARE);
  const w = handle.x === null ? along((box.right - box.left) * size.width) : handle.y === null ? EDGE / scale : CORNER / scale;
  const h = handle.y === null ? along((box.bottom - box.top) * size.height) : handle.x === null ? EDGE / scale : CORNER / scale;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
}

// The handle of a box (fractions of the image) a pointer at `q` (image px) takes hold of, if any: within reach of its
// drawn shape, corners first.
export function handleAt(box: Box, q: Point, size: { width: number; height: number }, scale: number): BoxHandle | null {
  const corners = BOX_HANDLES.filter((h) => h.x !== null && h.y !== null);
  const edges = BOX_HANDLES.filter((h) => h.x === null || h.y === null);
  for (const handle of [...corners, ...edges]) {
    const r = handleRect(box, handle, size, scale);
    // The distance from the pointer to the drawn shape, in screen px.
    const dx = Math.max(r.x - q.x, 0, q.x - (r.x + r.width)) * scale;
    const dy = Math.max(r.y - q.y, 0, q.y - (r.y + r.height)) * scale;
    if (Math.hypot(dx, dy) < HANDLE_REACH - CORNER / 2) return handle;
  }
  return null;
}

