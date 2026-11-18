import { useEffect, useRef, useState } from "react";
import { hashHistory } from "./hashHistory";
import { leavesProject, runningProject } from "./leaveGuard";
import { parseRoute } from "./route";
import { hasUnsaved } from "./saving";

// The app's navigation, its only owner of the history (hashHistory.ts): the hash shown, the question before leaving a
// running project (docs/project-view.md, "Leaving a running project"), and opening and closing an artifact or a
// stage's details. Used once, by the app; the pages are given what they need of it.
export type AppNavigation = {
  hash: string;
  // Goes to a URL from within the app, asking first if that leaves a running project or edits not saved; `then` runs
  // once it is there.
  navigate: (next: string, then?: () => void) => void;
  // Goes to a URL without asking: once the user has answered `whenLeaving`'s question.
  go: (next: string) => void;
  // Shows a URL in place of the one shown, without asking (hashHistory.ts, `replace`).
  replace: (next: string) => void;
  // Asks first if leaving the project shown would stop a run, then does `then` (nothing if the user stays): for what
  // leads to a URL not known yet, such as a project still to be created.
  whenLeaving: (then: () => void) => void;
  // Opens an artifact or a stage's details of the project shown, and closes it again: back in the history if it was
  // opened here, so that back doesn't reopen it; else in place of its URL, the project's.
  openDetail: (next: string) => void;
  closeDetail: (projectHash: string) => void;
  // While the question is asked: what Leave does, and whether leaving stops the run. Cancel is `stay`.
  leaving: (() => void) | null;
  leavingStopsRun: boolean;
  stay: () => void;
};

// Whether going to `next` stops a run on this device, or leaves an editor whose edits couldn't be saved (saving.ts):
// any change of the URL does, since what is shown changes. The hash shown never is (hashHistory goes back to it).
function holds(next: string): boolean {
  const running = runningProject();
  lastStopsRun = running !== null && leavesProject(next, running);
  return lastStopsRun || (hasUnsaved() && next !== shownHash);
}
// The hash the app shows.
let shownHash = typeof window === "undefined" ? "" : window.location.hash;
// Whether the change last held stops the run: what the question says (hashHistory asks right after holding).
let lastStopsRun = false;

export function useAppNavigation(): AppNavigation {
  const [hash, setHash] = useState(window.location.hash);
  const [leaving, setLeaving] = useState<{ then: () => void; stopsRun: boolean } | null>(null);
  // Whether the artifact or stage's details shown was opened from within the app.
  const openedHere = useRef(false);
  const [nav] = useState(() =>
    hashHistory(window, {
      holds,
      ask: (proceed) => setLeaving({ then: proceed, stopsRun: lastStopsRun }),
      onHash: (next) => {
        shownHash = next;
        const route = parseRoute(next);
        if (route?.artifactId == null && route?.stageId == null) openedHere.current = false;
        setHash(next);
      },
    }),
  );
  useEffect(() => {
    nav.start();
    return nav.stop;
  }, [nav]);

  return {
    hash,
    navigate: nav.navigate,
    go: nav.go,
    replace: nav.replace,
    whenLeaving: (then) => (holds("") ? setLeaving({ then, stopsRun: lastStopsRun }) : then()),
    openDetail: (next) => {
      openedHere.current = true;
      nav.go(next);
    },
    closeDetail: (projectHash) => {
      if (openedHere.current) {
        openedHere.current = false;
        nav.back();
      } else if (hasUnsaved()) {
        setLeaving({ then: () => nav.replace(projectHash), stopsRun: false });
      } else {
        nav.replace(projectHash);
      }
    },
    leaving: leaving
      ? () => {
          setLeaving(null);
          leaving.then();
        }
      : null,
    stay: () => setLeaving(null),
    leavingStopsRun: leaving?.stopsRun ?? false,
  };
}

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
