// The pages as the views show them (not the editors): a page image, with the lines that should be horizontal or the
// layout drawn over it (marks.tsx), and filmstrips of pages.

import { type ReactNode, useEffect, useState } from "react";
import type { SkewLine } from "@score3ly/imaging";
import { failure, fetchJsonContent } from "../api";
import type { PageLines } from "../fixSkew";
import { ImagesDiffer } from "../ImagesDiffer";
import { firstNumbers, numberSystems, type PageLayout } from "../layout";
import { pageImage, straightPage } from "../pageImages";
import { straightRecipe, type PageRecipe, type StraightRecipe } from "../recipes";
import { Filmstrip } from "../ui/Filmstrip";
import { useNear, useObjectUrl } from "../ui/hooks";
import { LayoutOverlay, LineOverlay } from "./marks";

// A page image, from the device's cache or drawn again from its recipe (docs/overview.md §5.3), once it scrolls near the
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
  const { ref: box, near } = useNear();
  const { url, error } = useObjectUrl(
    () => (straight ? straightPage(straight) : pageImage(recipe)),
    // The recipe's content, not the object, which is new on every render.
    [JSON.stringify(recipe), JSON.stringify(straight)],
    (err) => failure("This page can't be drawn", err),
    near,
  );

  return (
    <div ref={box} className="page-image">
      {url ? (
        <>
          <img src={url} alt={`Page ${recipe.page}`} />
          {linesSha256 && <StoredLines sha256={linesSha256} />}
          {children}
          <ImagesDiffer page={recipe} />
        </>
      ) : (
        <div className="page-placeholder error-text">{error ?? "Drawing the page…"}</div>
      )}
    </div>
  );
}

// The stored lines of a page (`skew_analysis`'s or `fix_skew`'s), drawn over it.
function StoredLines({ sha256 }: { sha256: string }) {
  const [lines, setLines] = useState<SkewLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJsonContent(sha256).then(
      (stored) => !cancelled && setLines((stored as PageLines).lines),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [sha256]);

  if (error) return <span className="line-label failed">Lines not loaded</span>;
  if (!lines) return null;
  return <LineOverlay lines={lines} />;
}

// The pages as they are (`rasterize`, with the lines of `skew_analysis` and `fix_skew` where they have them; the
// metadata's pages), opened at one of them, at the first without one.
export function PagesFilmstrip({ pages, page }: { pages: { page: number; recipe: PageRecipe; linesSha256?: string }[]; page?: number }) {
  const index = pages.findIndex((p) => p.page === page);
  return (
    <Filmstrip
      count={pages.length}
      wide={false}
      focus={index >= 0 ? { index } : undefined}
      render={(i) => (
        <figure className="film-item">
          <figcaption>Page {pages[i].page}</figcaption>
          <PageImageView recipe={pages[i].recipe} linesSha256={pages[i].linesSha256} />
        </figure>
      )}
    />
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
  const layoutPages = layouts.map((layout, i) => ({ page: pages[i].page, systems: layout.systems }));
  const firsts = firstNumbers(layoutPages);
  const focused = focusSystem === undefined ? undefined : numberSystems(layoutPages).find((s) => s.number === focusSystem);
  const focus = focused && { index: focused.pageIndex, y: (focused.layout.box.top + focused.layout.box.bottom) / 2 };
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
  const straight = straightRecipe(recipe, layout.angle);
  return (
    <>
      {(layout.flagged || layout.severelySkewed) && (
        <p className="layout-flags">
          {layout.flagged && <span className="layout-flag">Flagged for a check{layout.note ? `: ${layout.note}` : ""}</span>}
          {layout.severelySkewed && <span className="layout-flag">Severely skewed</span>}
        </p>
      )}
      <PageImageView recipe={recipe} straight={straight}>
        <LayoutOverlay systems={layout.systems} first={first} />
      </PageImageView>
    </>
  );
}
