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

// The two editions of the app (DESIGN.md §3, "Editions"): *concerto* on Cloudflare, every device in sync; *cadenza*
// on one computer (the desktop app, or its server run alone).
export type Edition = "concerto" | "cadenza";

export function editionOf(host: Host): Edition {
  return host === "cloudflare" ? "concerto" : "cadenza";
}

export const EDITION_TEXT: Record<Edition, string> = {
  concerto:
    "uses cloud storage and remote servers. You can log into your account on different devices and your projects are kept in sync across them.",
  cadenza: "runs and stores all files on your device. There's no account to log into. Installations on different devices share no data.",
};

// The window's title (a tab's, an installed app's title bar, the desktop app's window), "score3ly – concerto", and
// the tab's icon: cadenza's own (its plain server opens in a browser tab; Electron sets the window's icon itself).
export function useEditionWindow() {
  const host = useHost();
  useEffect(() => {
    document.title = host ? `score3ly – ${editionOf(host)}` : "score3ly";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon && host) icon.href = editionOf(host) === "cadenza" ? "/icon-cadenza.svg" : "/icon.svg";
  }, [host]);
}
