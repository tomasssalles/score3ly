// Keeps the same spot of a document at the top of a scroll pane when the pages change size.
// A page is described by its top position and height in the pane's scroll coordinates.

export type PageBox = { top: number; height: number };

// The page at the top edge, and how far down that page the edge is (0 = page top, 1 = page bottom).
export type ScrollAnchor = { page: number; fraction: number };

export function anchorAt(pages: PageBox[], scrollTop: number): ScrollAnchor {
  // The last page starting at or above the top edge. Gaps between pages count towards the page above.
  let page = 0;
  while (page + 1 < pages.length && pages[page + 1].top <= scrollTop) {
    page++;
  }
  const { top, height } = pages[page] ?? { top: 0, height: 0 };
  const fraction = height > 0 ? Math.min(Math.max((scrollTop - top) / height, 0), 1) : 0;
  return { page, fraction };
}

export function scrollTopFor(pages: PageBox[], anchor: ScrollAnchor): number {
  const box = pages[anchor.page];
  return box === undefined ? 0 : box.top + anchor.fraction * box.height;
}
