import { useEffect, useState } from "react";

// Back and forward in the app's history, for windows without a browser bar (docs/desktop.md, "Navigation"): an
// installed app, the desktop app. The app's navigation is the URL's hash (route.ts), so the browser's own history is
// the app's: back closes an artifact or a stage's details, or leaves a menu page.

// The Navigation API's part used here (Chromium, so Electron and installed apps on Android and desktop; Safari 26.2).
type NavigationLike = EventTarget & { canGoBack: boolean; canGoForward: boolean };

function navigationApi(): NavigationLike | null {
  const navigation = (window as { navigation?: NavigationLike }).navigation;
  return navigation && typeof navigation.canGoBack === "boolean" ? navigation : null;
}

export type BackForward = { canGoBack: boolean; canGoForward: boolean; back: () => void; forward: () => void };

// Whether there is somewhere to go. Without the Navigation API this can't be known, so both are allowed: at the
// ends of the history they do nothing.
export function useBackForward(): BackForward {
  const read = () => {
    const navigation = navigationApi();
    return navigation ? { canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward } : { canGoBack: true, canGoForward: true };
  };
  const [state, setState] = useState(read);

  useEffect(() => {
    const update = () => setState(read());
    const navigation = navigationApi();
    navigation?.addEventListener("currententrychange", update);
    window.addEventListener("hashchange", update);
    return () => {
      navigation?.removeEventListener("currententrychange", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);

  return { ...state, back: () => history.back(), forward: () => history.forward() };
}

// The display modes in which the app has no browser bar (the manifest's "standalone"; "minimal-ui" keeps a back
// button of the browser's).
const NO_BROWSER_BAR = "(display-mode: standalone), (display-mode: fullscreen), (display-mode: window-controls-overlay)";

// Whether the app runs without a browser bar, so it shows its own back and forward buttons. The condition is "no
// browser bar", not the platform (§3). Changes when, e.g., an installed app's window is opened in the browser.
export function useNoBrowserBar(): boolean {
  const query = () => window.matchMedia?.(NO_BROWSER_BAR);
  const [matches, setMatches] = useState(() => query()?.matches ?? false);

  useEffect(() => {
    const list = query();
    if (!list) return;
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);

  return matches;
}
