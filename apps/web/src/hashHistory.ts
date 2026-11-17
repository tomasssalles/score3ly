// The app's history: its navigation is the URL's hash (route.ts), and this is the only code that changes it, apart
// from the browser's own traversals (back, forward, a link, a URL typed in), which it hears of as `hashchange`.
//
// The hold (docs/project-view.md, "Leaving a running project"): a change that leaves a running project waits for the
// user's answer. The history is then put back as it was: each entry is numbered in its state (`score3lyIndex`), its
// position in the history, so a held step back or forward is undone by the opposite step, and a held new entry (a
// link, a hash typed in) by going back to the one before it. The numbers stay positions only if every replace keeps
// the replaced entry's number, so the app replaces through `replace` here, never `location.replace` (whose entry
// would come without a number and be taken for a new one).
//
// Pure apart from the window it is given, so that it can be tested with a fake history.

// The parts of `window` used here.
export type NavWindow = {
  location: { hash: string };
  history: { readonly state: unknown; go(delta: number): void; back(): void; replaceState(state: unknown, unused: string, url?: string): void };
  addEventListener(type: "hashchange", listener: () => void): void;
  removeEventListener(type: "hashchange", listener: () => void): void;
};

export type HashHistoryOptions = {
  // Whether going to `next` must wait for the user's answer.
  holds: (next: string) => boolean;
  // Asks the user; `proceed` makes the change after all. Not called when the user stays.
  ask: (proceed: () => void) => void;
  // The hash now shown.
  onHash: (hash: string) => void;
};

export type HashHistory = {
  // Starts listening, and numbers the entry shown if it has no number yet. `stop` undoes the listening.
  start(): void;
  stop(): void;
  // Goes to `next` as a new entry, asking first if it is held; `then` runs once it is there (not if the user stays).
  navigate(next: string, then?: () => void): void;
  // Goes to `next` as a new entry, without asking.
  go(next: string): void;
  // Shows `next` in place of the entry shown, keeping its number, without asking: for changes that don't leave a
  // project (a tab, closing an artifact) or whose project is gone.
  replace(next: string): void;
  back(): void;
};

function numberOf(state: unknown): number | null {
  const at = (state as { score3lyIndex?: unknown } | null)?.score3lyIndex;
  return typeof at === "number" ? at : null;
}

export function hashHistory(win: NavWindow, { holds, ask, onHash }: HashHistoryOptions): HashHistory {
  let index = 0; // the number of the entry shown
  let allowed: string | null = null; // a hash to go to without asking: asked already, or the app's own
  const stamp = (number: number, url?: string) => {
    const state = win.history.state;
    win.history.replaceState({ ...(typeof state === "object" ? state : {}), score3lyIndex: number }, "", url);
  };

  const onHashChange = () => {
    const next = win.location.hash;
    const at = numberOf(win.history.state);
    if (allowed !== next) {
      const delta = at === null ? 1 : at - index;
      if (holds(next)) {
        win.history.go(-delta); // back to the entry shown; its hash isn't held, so it is simply taken again
        ask(() => {
          allowed = next;
          if (at === null) win.location.hash = next;
          else win.history.go(delta);
        });
        return;
      }
    }
    allowed = null;
    if (at === null) {
      index += 1;
      stamp(index);
    } else {
      index = at;
    }
    onHash(next);
  };

  const go = (next: string) => {
    allowed = next;
    win.location.hash = next;
  };

  return {
    start() {
      const at = numberOf(win.history.state);
      if (at === null) stamp(0);
      index = at ?? 0;
      win.addEventListener("hashchange", onHashChange);
    },
    stop() {
      win.removeEventListener("hashchange", onHashChange);
    },
    navigate(next, then) {
      const goThere = () => {
        go(next);
        then?.();
      };
      if (holds(next)) ask(goThere);
      else goThere();
    },
    go,
    replace(next) {
      stamp(index, next);
      onHash(win.location.hash);
    },
    back() {
      win.history.back();
    },
  };
}
