// Small hooks the UI shares.

import { type DependencyList, type RefObject, useEffect, useRef, useState } from "react";

// While `open`, a tap or click outside `ref`'s element calls `onOutside` (a menu, the project picker).
export function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, onOutside: () => void) {
  const latest = useRef(onOutside);
  latest.current = onOutside;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) latest.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);
}

// Whether the media query matches, kept up to date (false where the browser can't tell).
export function useMediaQuery(query: string): boolean {
  const list = () => window.matchMedia?.(query);
  const [matches, setMatches] = useState(() => list()?.matches ?? false);
  useEffect(() => {
    const l = list();
    if (!l) return;
    const update = () => setMatches(l.matches);
    l.addEventListener("change", update);
    return () => l.removeEventListener("change", update);
  }, [query]);
  return matches;
}

// Starts work for an element once it scrolls near the view: a filmstrip of 50 systems would otherwise cut and render
// every one at once. `near` stays true.
export function useNear<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "100% 0px" });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return { ref, near };
}

// A file made by `load` (an image, a PDF), as an object URL released when it is no longer shown; or the error, as
// `failure` words it. Loaded again when `deps` change; nothing is done while `enabled` is false. `load` is given whether
// its result is still wanted, for what it shows meanwhile.
export function useObjectUrl(
  load: (wanted: () => boolean) => Promise<Blob>,
  deps: DependencyList,
  failed: (err: unknown) => string | null,
  enabled = true,
): { url: string | null; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    load(() => !cancelled).then(
      (blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      (err) => !cancelled && setError(failed(err)),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, ...deps]);
  return { url, error };
}
