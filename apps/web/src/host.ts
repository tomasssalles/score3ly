import { useEffect, useState } from "react";
import { fetchHost, type Host } from "./api";

// Which host serves the app, asked once (DESIGN.md §3): the UI asks the server and decides nowhere else by host.
// null until known, or if the server can't say.
let asked: Promise<Host | null> | null = null;

export function useHost(): Host | null {
  const [host, setHost] = useState<Host | null>(null);
  useEffect(() => {
    asked ??= fetchHost().catch(() => null);
    let cancelled = false;
    asked.then((h) => !cancelled && setHost(h));
    return () => {
      cancelled = true;
    };
  }, []);
  return host;
}
