// Which host serves the app (docs/desktop.md, "What differs in the app"; `GET /api/info`): Cloudflare, the desktop app
// (Electron) or the same server run alone on a computer. Nothing else in the app decides by host.

export type Host = "cloudflare" | "desktop" | "local";

export type Info = { host: Host };

// The desktop app's window frame, drawn by the system (`POST /api/window/theme`): in the app theme's light or dark, or
// the system's for Auto (docs/desktop.md).
export type WindowTheme = "system" | "dark" | "light";

export function isWindowTheme(value: unknown): value is WindowTheme {
  return value === "system" || value === "dark" || value === "light";
}
