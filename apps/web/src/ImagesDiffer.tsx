// The warning that an image on this device differs from the one a stored result was computed from (DESIGN.md §8.3):
// a warning, never a stop. Shown over every image of the page concerned (the page itself, straightened, its crops).

import { useEffect, useState } from "react";
import { useHost } from "./host";
import { keyOf } from "./keys";
import { onImagesDiffer, pageDiffers } from "./pageImages";
import type { PageRecipe } from "./rasterize";

// The likely causes: another device, or this one before an update (of the browser, or of Electron in the desktop app,
// which is the only device its data is on).
export function differsCause(desktop: boolean): string {
  return desktop ? "probably before a recent update" : "probably on another device, or before a recent update";
}

export function imagesDifferText(desktop: boolean): string {
  return `This image differs from the one the stored results were made from (${differsCause(desktop)}); boxes or answers may not fit it.`;
}

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
  const desktop = useHost() === "desktop";
  return usePageDiffers(page) ? (
    <p className={below ? "images-differ below" : "images-differ"} role="status">
      {imagesDifferText(desktop)}
    </p>
  ) : null;
}
