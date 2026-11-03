import { useEffect, useRef, useState } from "react";

// The URL's hash ("#/..."), kept up to date when it changes (navigation, back button, edited by hand).
//
// `hold`, if given, may keep a change from happening (docs/project-view.md, "Leaving a running project"): it gets the
// new hash and a `proceed` function, and returns true to hold the change. The history is then put back as it was:
// each entry is numbered in its state, so a held step back or forward is undone by the opposite step, and a held new
// entry (a link, a hash typed in) by going back to the one before it. `proceed` makes the change after all.
export function useHash(hold?: (next: string, proceed: () => void) => boolean): { hash: string; go: (hash: string) => void } {
  const [hash, setHash] = useState(window.location.hash);
  const index = useRef(0); // the number of the history entry shown
  const allowed = useRef<string | null>(null);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  useEffect(() => {
    const numbered = history.state?.score3lyIndex;
    if (typeof numbered === "number") index.current = numbered;
    else history.replaceState({ ...history.state, score3lyIndex: 0 }, "");

    const onHashChange = () => {
      const next = window.location.hash;
      const at: unknown = history.state?.score3lyIndex;
      const isNew = typeof at !== "number";
      if (allowed.current !== next) {
        const delta = isNew ? 1 : (at as number) - index.current;
        const proceed = () => {
          allowed.current = next;
          if (isNew) window.location.hash = next;
          else history.go(delta);
        };
        if (holdRef.current?.(next, proceed)) {
          history.go(-delta); // back to the entry shown; its hash isn't held, so it is simply taken again
          return;
        }
      }
      allowed.current = null;
      if (isNew) {
        index.current += 1;
        history.replaceState({ ...history.state, score3lyIndex: index.current }, "");
      } else {
        index.current = at as number;
      }
      setHash(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const go = (next: string) => {
    allowed.current = next;
    window.location.hash = next;
  };
  return { hash, go };
}
