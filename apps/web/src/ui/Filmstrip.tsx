import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

// For groups of items.
// The items of a group one below the other, scrolling continuously, so the end of one item and the start of the
// next can be seen together. A counter in the corner says which item is in view.
// With `focus`, it opens scrolled to an item: its top at the top of the view, or with `y` (a fraction of the item's
// page image) that point in the middle of the view. Pages load as they come near, and change size when they do, so it
// keeps that place until the user scrolls.
export function Filmstrip({
  count,
  wide,
  render,
  focus,
  overlay,
}: {
  count: number;
  wide: boolean;
  render: (i: number) => ReactNode;
  focus?: { index: number; y?: number };
  // Drawn over the top of the scrolling part, which starts with as much empty space as it is high, so that it hides
  // nothing until the content is scrolled under it, and showing or hiding it (with `visibility`) moves nothing.
  overlay?: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const overlayBox = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState({ height: 0, scrollbar: 0 });
  const hasOverlay = overlay !== undefined;

  useLayoutEffect(() => {
    const box = overlayBox.current;
    const el = scroller.current!;
    if (!box) return;
    const measure = () => setOverlaySize({ height: box.offsetHeight, scrollbar: el.offsetWidth - el.clientWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOverlay]);

  useEffect(() => {
    if (!focus) return;
    const el = scroller.current!;
    const content = items.current!; // the items, not the overlay's spacer above them
    let following = true;
    const place = () => {
      const item = el.querySelectorAll<HTMLElement>(".film-item")[focus.index];
      if (!following || !item) return;
      const top = el.getBoundingClientRect().top - el.scrollTop;
      const image = item.querySelector<HTMLElement>(".page-image");
      if (focus.y !== undefined && image) {
        const rect = image.getBoundingClientRect();
        el.scrollTop = rect.top - top + focus.y * rect.height - el.clientHeight / 2;
      } else {
        el.scrollTop = item.getBoundingClientRect().top - top - 8 - (overlayBox.current?.offsetHeight ?? 0);
      }
    };
    const stop = () => {
      following = false;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(content);
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const event of events) el.addEventListener(event, stop, { passive: true });
    return () => {
      observer.disconnect();
      for (const event of events) el.removeEventListener(event, stop);
    };
  }, [focus?.index, focus?.y]);

  useEffect(() => {
    const el = scroller.current!;
    // The item in view is the last one whose top is above the view's middle.
    const onScroll = () => {
      const middle = el.getBoundingClientRect().top + el.clientHeight / 2;
      const items = [...el.querySelectorAll<HTMLElement>(".film-item")];
      let i = 0;
      while (i + 1 < items.length && items[i + 1].getBoundingClientRect().top <= middle) i++;
      setCurrent(i);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="filmstrip-frame">
      <div className="filmstrip" ref={scroller} style={hasOverlay ? { scrollPaddingTop: overlaySize.height } : undefined}>
        {hasOverlay && <div style={{ height: overlaySize.height }} aria-hidden="true" />}
        <div className={wide ? "film-items wide" : "film-items"} ref={items}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i}>{render(i)}</div>
          ))}
        </div>
      </div>
      {hasOverlay && (
        <div className="filmstrip-overlay" ref={overlayBox} style={{ right: overlaySize.scrollbar }}>
          {overlay}
        </div>
      )}
      <span className="film-counter">
        {current + 1} / {count}
      </span>
    </div>
  );
}
