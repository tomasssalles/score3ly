import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Project } from "./api";
import { CloseIcon } from "./icons";
import { MockPage, MockSystem, mockText } from "./mockContent";
import type { Output } from "./pipeline";
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

// An output: the original PDF, or (mock) images and texts. A group is shown as a filmstrip.
export function OutputContent({ project, output }: { project: Project; output: Output }) {
  if (output.kind === "pdf") return <PdfView key={project.pdfSha256} url={pdfUrl(project.pdfSha256)} />;
  if (output.count === 1) {
    return (
      <div className="text-view">
        <pre>{mockText(output)}</pre>
      </div>
    );
  }
  const item = output.item ?? "Item";
  const boxes = output.id.includes("boxes");
  return (
    <Filmstrip
      key={output.id}
      count={output.count}
      wide={item === "System"}
      render={(i) => (
        <figure className="film-item">
          <figcaption>
            {item} {i + 1}
          </figcaption>
          {item === "Page" ? <MockPage index={i} boxes={boxes} /> : <MockSystem index={i} />}
          {output.kind === "lilypond" && <pre>{mockText(output, i)}</pre>}
        </figure>
      )}
    />
  );
}

// The items of a group one below the other, scrolling continuously, so the end of one item and the start of the
// next can be seen together. A counter in the corner says which item is in view.
function Filmstrip({ count, wide, render }: { count: number; wide: boolean; render: (i: number) => ReactNode }) {
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
