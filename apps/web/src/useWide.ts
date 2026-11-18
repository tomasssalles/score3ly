import { useMediaQuery } from "./ui/hooks";

// Wide mode (two panes) from 1024 px, narrow mode below. Must match the breakpoint in styles.css.
const WIDE = "(min-width: 1024px)";

export function useWide(): boolean {
  return useMediaQuery(WIDE);
}
