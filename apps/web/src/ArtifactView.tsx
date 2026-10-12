import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Project } from "./api";
import { CloseIcon } from "./icons";
import type { Artifact } from "./pipeline";
import { pdfUrl } from "./pdf";
import { PdfView } from "./PdfView";

// Shows one output or a stage's details, and nothing else: what is shown can be seen in the pipeline panel.
// In narrow mode it covers the whole app and has a close button floating over it.
export function ArtifactView({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={onClose ? "artifact-view overlay" : "artifact-view"} aria-label={label}>
      {onClose && (
        <button type="button" className="artifact-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      )}
      {children}
    </section>
  );
}

// An artifact: the original PDF, or, for the kinds no stage produces yet, a note saying it can't be shown.
export function ArtifactContent({ project, artifact }: { project: Project; artifact: Artifact }) {
  if (artifact.kind === "pdf") return <PdfView key={project.pdfSha256} url={pdfUrl(project.pdfSha256)} />;
  return (
    <div className="text-view">
      <p>This artifact can't be shown yet.</p>
    </div>
  );
}

// For groups (no stage produces one yet, DESIGN.md §5.6).
// The items of a group one below the other, scrolling continuously, so the end of one item and the start of the
// next can be seen together. A counter in the corner says which item is in view.
export function Filmstrip({ count, wide, render }: { count: number; wide: boolean; render: (i: number) => ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

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
      <div className="filmstrip" ref={scroller}>
        <div className={wide ? "film-items wide" : "film-items"}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i}>{render(i)}</div>
          ))}
        </div>
      </div>
      <span className="film-counter">
        {current + 1} / {count}
      </span>
    </div>
  );
}
