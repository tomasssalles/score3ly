// A load made once and kept (a WASM module, a compiled schema), except when it fails: then it is forgotten, and the
// next call tries again, instead of every later use failing until the page is reloaded.
export function keptUntilFailure<T>(load: () => Promise<T>): () => Promise<T> {
  let kept: Promise<T> | null = null;
  return () => {
    if (kept) return kept;
    const made = load();
    kept = made;
    made.catch(() => {
      if (kept === made) kept = null;
    });
    return made;
  };
}
