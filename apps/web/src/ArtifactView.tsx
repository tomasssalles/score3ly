import { type ReactNode, useEffect, useRef, useState } from "react";
import { fetchJsonContent, type Project } from "./api";
import { CloseIcon } from "./icons";
import { DESKEW_VERSION, LAYOUT_COLOR_HEX, ROTATE_VERSION } from "@score3ly/imaging";
import type { PageLayout } from "./layout";
import { pageImage, straightPage, type StraightRecipe } from "./pageImages";
import type { Artifact } from "./pipeline";
import type { PageRecipe } from "./rasterize";
import { angleLabel, type PageSkew } from "./skewAnalysis";
import type { SkewLine } from "@score3ly/imaging";
import { pdfUrl } from "./pdf";
import { PdfView } from "./PdfView";
import { SkewEditor } from "./SkewEditor";
import { AnalysisView } from "./AnalysisView";
import { ExtractionView } from "./ExtractionView";
import { LayoutEditor } from "./LayoutEditor";
import { firstNumbers } from "./fixLayout";

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

// An artifact: the original PDF, the page images, a manual stage's editor, or, for the kinds no stage produces yet, a note saying it can't
// be shown.
export function ArtifactContent({
  project,
  artifact,
  onEdited,
}: {
  project: Project;
  artifact: Artifact;
  onEdited?: () => void; // an editor saved something
}) {
  if (artifact.kind === "pdf") return <PdfView key={project.pdfSha256} url={pdfUrl(project.pdfSha256)} />;
  const pages = artifact.pages;
  if (artifact.analysis) return <AnalysisView key={artifact.id} project={project} artifact={artifact} onEdited={onEdited} />;
  if (artifact.extraction) return <ExtractionView key={artifact.id} artifact={artifact} />;
  // A WIP manual stage's artifact is its editor (DESIGN.md §5.6).
  if (artifact.editor?.step === "fix_skew" && pages) {
    const editable = pages.flatMap((p) =>
      p.linesSha256 && p.item && p.parentId ? [{ ...p, linesSha256: p.linesSha256, item: p.item, parentId: p.parentId }] : [],
    );
    return <SkewEditor key={artifact.id} project={project} stageId={artifact.editor.stageId} pages={editable} onEdited={onEdited} />;
  }
  if (artifact.editor?.step === "fix_layout" && pages) {
    const editable = pages.flatMap((p) =>
      p.layoutSha256 && p.item && p.parentId ? [{ ...p, layoutSha256: p.layoutSha256, item: p.item, parentId: p.parentId }] : [],
    );
    return <LayoutEditor key={artifact.id} project={project} stageId={artifact.editor.stageId} pages={editable} onEdited={onEdited} />;
  }
  if (artifact.kind === "images" && pages?.some((p) => p.layoutSha256)) {
    return <LayoutFilmstrip key={artifact.id} pages={pages.flatMap((p) => (p.layoutSha256 ? [{ ...p, layoutSha256: p.layoutSha256 }] : []))} />;
  }
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
export function PageImageView({
  recipe,
  linesSha256,
  straight,
  children,
}: {
  recipe: PageRecipe;
  linesSha256?: string;
  straight?: StraightRecipe; // show the page straightened so, instead of as rasterized
  children?: ReactNode; // drawn over the image
}) {
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
    (straight ? straightPage(straight).then((png) => ({ png })) : pageImage(recipe)).then(
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
  }, [near, JSON.stringify(recipe), JSON.stringify(straight)]);

  return (
    <div ref={box} className="page-image">
      {url ? (
        <>
          <img src={url} alt={`Page ${recipe.page}`} />
          {linesSha256 && <LinesOverlay sha256={linesSha256} />}
          {children}
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

// The pages of a layout (`layout`, `fix_layout`): all of them are loaded first, since the systems are numbered from
// page to page (the first system on page 2 is 5 if page 1 has 4).
// With `focusSystem`, it opens with that system (its number in the whole score) in the middle of the view.
export function LayoutFilmstrip({
  pages,
  focusSystem,
}: {
  pages: { page: number; recipe: PageRecipe; layoutSha256: string }[];
  focusSystem?: number;
}) {
  const [layouts, setLayouts] = useState<PageLayout[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(pages.map((p) => fetchJsonContent(p.layoutSha256) as Promise<PageLayout>)).then(
      (loaded) => !cancelled && setLayouts(loaded),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [pages.map((p) => p.layoutSha256).join()]);

  if (error) return <div className="text-view"><p>The layouts couldn't be loaded.</p></div>;
  if (!layouts) return <div className="text-view"><p>Loading the layouts…</p></div>;
  const firsts = firstNumbers(layouts.map((layout) => layout.systems.length));
  let focus: { index: number; y: number } | undefined;
  if (focusSystem !== undefined) {
    const index = layouts.findIndex((l, i) => focusSystem >= firsts[i] && focusSystem < firsts[i] + l.systems.length);
    if (index >= 0) {
      const { top, bottom } = layouts[index].systems[focusSystem - firsts[index]].box;
      focus = { index, y: (top + bottom) / 2 };
    }
  }
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      focus={focus}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {pages[i].page}</figcaption>
          <LayoutPageView recipe={pages[i].recipe} layout={layouts[i]} first={firsts[i]} />
        </figure>
      )}
    />
  );
}

// A page's layout: the page straightened as the layout says, its system boxes and bar lines drawn over it in the
// same colours the model saw, each box numbered (from `first`); a flag and the model's note when it wasn't
// satisfied.
function LayoutPageView({ recipe, layout, first }: { recipe: PageRecipe; layout: PageLayout; first: number }) {
  const straight: StraightRecipe = { page: recipe, angle: layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION };
  return (
    <>
      {(layout.flagged || layout.severelySkewed) && (
        <p className="layout-flags">
          {layout.flagged && <span className="layout-flag">Flagged for a check{layout.note ? `: ${layout.note}` : ""}</span>}
          {layout.severelySkewed && <span className="layout-flag">Severely skewed</span>}
        </p>
      )}
      <PageImageView recipe={recipe} straight={straight}>
        <div className="lines-overlay">
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {layout.systems.map((system, i) => {
              const color = LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length];
              const { left, right, top, bottom } = system.box;
              return (
                <g key={i} stroke={color} className="layout-system">
                  <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" />
                  {system.barLines.map((x, j) => (
                    <line key={j} x1={x} x2={x} y1={top} y2={bottom} className="bar-line" />
                  ))}
                </g>
              );
            })}
          </svg>
          {layout.systems.map((system, i) => (
            <span
              key={i}
              className="system-label"
              style={{
                left: `${system.box.left * 100}%`,
                top: `${system.box.top * 100}%`,
                background: LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length],
              }}
            >
              {first + i}
            </span>
          ))}
        </div>
      </PageImageView>
    </>
  );
}

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
}: {
  count: number;
  wide: boolean;
  render: (i: number) => ReactNode;
  focus?: { index: number; y?: number };
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!focus) return;
    const el = scroller.current!;
    const content = el.firstElementChild as HTMLElement;
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
        el.scrollTop = item.getBoundingClientRect().top - top - 8;
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
