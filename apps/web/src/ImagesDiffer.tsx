// The warning that an image on this device differs from the one a stored result was computed from (DESIGN.md §8.3):
// a warning, never a stop. Shown over every image of the page concerned (the page itself, straightened, its crops).

import { useEffect, useState } from "react";
import { keyOf } from "./keys";
import { onImagesDiffer, pageDiffers } from "./pageImages";
import type { PageRecipe } from "./rasterize";

export const IMAGES_DIFFER_TEXT =
  "This image differs from the one the stored results were made from on another device; boxes or answers may not fit it.";

// Whether this device's images of the page differ from the ones stored results were computed from.
export function usePageDiffers(page: PageRecipe | null): boolean {
  const [key, setKey] = useState<string | null>(null);
  const [differs, setDiffers] = useState(false);
  const recipe = JSON.stringify(page);
  useEffect(() => {
    let cancelled = false;
    if (page) keyOf(page).then((k) => !cancelled && setKey(k));
    return () => {
      cancelled = true;
    };
  }, [recipe]);
  useEffect(() => {
    if (!key) return;
    setDiffers(pageDiffers(key));
    return onImagesDiffer(() => setDiffers(pageDiffers(key)));
  }, [key]);
  return differs;
}

// Over the image's top, or below it (`below`) where the image is a short strip (a system's crop) and a banner would
// hide its music.
export function ImagesDiffer({ page, below = false }: { page: PageRecipe | null; below?: boolean }) {
  return usePageDiffers(page) ? (
    <p className={below ? "images-differ below" : "images-differ"} role="status">
      {IMAGES_DIFFER_TEXT}
    </p>
  ) : null;
}
