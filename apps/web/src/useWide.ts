import { useEffect, useState } from "react";

// Wide mode (two panes) from 1024 px, narrow mode below. Must match the breakpoint in styles.css.
const WIDE = "(min-width: 1024px)";

export function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return wide;
}
