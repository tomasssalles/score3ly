import { useLayoutEffect, useRef } from "react";
import { largestFitting, splitAtMatch, truncateMiddle } from "./fit";

// A text (a project or file name) that wraps over up to `lines` lines. If it needs more, it is shortened
// in the middle until it fits, and hovering shows all of it. The first occurrence of `highlight` is marked.
//
// The browser can only cut a text off at its end, so this component measures: it puts candidate texts into
// the element and checks its height. That is why the element's content is set here by hand, not by React.
export function FittedText({
  text,
  lines,
  highlight = "",
  className = "",
}: {
  text: string;
  lines: number;
  highlight?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    let fittedWidth = -1;

    function fit() {
      fittedWidth = el.clientWidth;
      el.textContent = "x";
      const maxHeight = lines * el.getBoundingClientRect().height + 1;
      const fits = (keep: number) => {
        el.textContent = truncateMiddle(text, keep);
        return el.getBoundingClientRect().height <= maxHeight;
      };
      const length = Array.from(text).length;
      const keep = fits(length) ? length : largestFitting(length - 1, fits);
      show(el, truncateMiddle(text, keep), highlight);
      el.title = keep < length ? text : "";
    }

    fit();
    // Fit again when the available width changes (the height changes with every fit, so that is ignored),
    // and when the fonts have loaded, since they change how much fits.
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== fittedWidth && el.clientWidth > 0) fit();
    });
    observer.observe(el);
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text, lines, highlight]);

  // A text without spaces (typically a file name) fills each line; one with spaces breaks between words.
  const wrapping = text.includes(" ") ? "" : "unspaced";
  return <span ref={ref} className={`fitted ${wrapping} ${className}`} />;
}

function show(el: HTMLElement, text: string, highlight: string) {
  const parts = splitAtMatch(text, highlight);
  if (parts === null) {
    el.textContent = text;
    return;
  }
  const mark = document.createElement("mark");
  mark.textContent = parts[1];
  el.replaceChildren(parts[0], mark, parts[2]);
}
