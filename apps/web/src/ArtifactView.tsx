import { type ReactNode, useEffect, useRef, useState } from "react";
import { fetchJsonContent, type Project } from "./api";
import { CloseIcon } from "./icons";
import { pageImage } from "./pageImages";
import type { Artifact } from "./pipeline";
import type { PageRecipe } from "./rasterize";
import { angleLabel, type PageSkew } from "./skewAnalysis";
import type { SkewLine } from "@score3ly/imaging";
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

// An artifact: the original PDF, the page images, or, for the kinds no stage produces yet, a note saying it can't
// be shown.
export function ArtifactContent({ project, artifact }: { project: Project; artifact: Artifact }) {
  if (artifact.kind === "pdf") return <PdfView key={project.pdfSha256} url={pdfUrl(project.pdfSha256)} />;
  const pages = artifact.pages;
  if (artifact.kind === "images" && pages) {
    return (
      <Filmstrip
        key={artifact.id}
        count={pages.length}
        wide={false}
        render={(i) => (
          <figure className="film-item">
            <figcaption>Page {pages[i].page}</figcaption>
            <PageImageView recipe={pages[i].recipe} linesSha256={pages[i].linesSha256} />
          </figure>
        )}
      />
    );
  }
  return (
    <div className="text-view">
      <p>This artifact can't be shown yet.</p>
    </div>
  );
}

// A page image, from the device's cache or drawn again from its recipe (DESIGN.md §5.3), once it scrolls near the
// view: a filmstrip of large scans would otherwise draw every page at once. With `linesSha256`, the lines that should
// be horizontal (skew_analysis) are drawn over it in red, each labelled with its angle (§6).
function PageImageView({ recipe, linesSha256 }: { recipe: PageRecipe; linesSha256?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "100% 0px",
    });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    pageImage(recipe).then(
      ({ png }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setUrl(objectUrl);
      },
      (err) => !cancelled && setError(`This page can't be drawn: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // The recipe's content, not the object, which is new on every render.
  }, [near, JSON.stringify(recipe)]);

  return (
    <div ref={box} className="page-image">
      {url ? (
        <>
          <img src={url} alt={`Page ${recipe.page}`} />
          {linesSha256 && <LinesOverlay sha256={linesSha256} />}
        </>
      ) : (
        <div className="page-placeholder">{error ?? "Drawing the page…"}</div>
      )}
    </div>
  );
}

// The lines over a page: stretched to the page (the coordinates are fractions of it), with labels as HTML so the
// stretching doesn't distort them.
function LinesOverlay({ sha256 }: { sha256: string }) {
  const [lines, setLines] = useState<SkewLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJsonContent(sha256).then(
      (skew) => !cancelled && setLines((skew as PageSkew).lines),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [sha256]);

  if (error) return <span className="line-label failed">Lines not loaded</span>;
  if (!lines) return null;
  return (
    <div className="lines-overlay">
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {lines.map((line, i) => (
          <line key={i} x1={line.x0} y1={line.y0} x2={line.x1} y2={line.y1} />
        ))}
      </svg>
      {lines.map((line, i) => (
        <span key={i} className="line-label" style={{ left: `${line.x0 * 100}%`, top: `${line.y0 * 100}%` }}>
          {angleLabel(line.angle)}
        </span>
      ))}
    </div>
  );
}

// For groups of items.
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
