// The bounds of a zoomed and panned page (pageEditor.tsx): how far it can be zoomed out and panned. Apart, so that
// the tests can import it without React.

export type View = { scale: number; x: number; y: number }; // screen px per image px, and where the image's corner is
type Size = { width: number; height: number };
type Room = { clientWidth: number; clientHeight: number };

// Room around the page, in screen px: where a fitted page's edges sit, and how far past its edges panning may go.
export const PAD = 12;

// The scale at which a page fits whole in a view, with PAD around it.
export function wholePageScale(el: Room, image: Size): number {
  return Math.max(1e-3, Math.min((el.clientWidth - 2 * PAD) / image.width, (el.clientHeight - 2 * PAD) / image.height));
}

// A view moved back within bounds: in each direction, a page larger than the view (with PAD on both sides) can't be
// panned further than PAD past its edges, and a smaller one is centred.
export function clampView(view: View, el: Room | null, image: Size | null): View {
  if (!el || !image || !el.clientWidth || !el.clientHeight) return view;
  const axis = (pos: number, content: number, room: number) =>
    content + 2 * PAD <= room ? (room - content) / 2 : Math.min(PAD, Math.max(room - content - PAD, pos));
  return { scale: view.scale, x: axis(view.x, image.width * view.scale, el.clientWidth), y: axis(view.y, image.height * view.scale, el.clientHeight) };
}
