// The desktop app's main process (DESIGN.md §3, "Desktop version"): starts the server (server.ts) on 127.0.0.1 with
// the data in the app's data folder, and shows it in a window. The web app is the same as on Cloudflare; what Electron
// adds is what a browser would: back and forward by keyboard, mouse and swipe, links opening in the browser.

import { app, BrowserWindow, shell, type Input } from "electron";
import { join } from "node:path";
import { startServer, type RunningServer } from "./server.ts";

// The data folder is named after the app, not the package ("desktop").
app.setName("score3ly");

let server: RunningServer | null = null;
let window: BrowserWindow | null = null;

// Back and forward, which Electron doesn't bind by itself (§3, "Navigation"): Alt+←/→ on Windows and Linux, Cmd+[/]
// and Cmd+←/→ on macOS, and the keyboards' own Back and Forward keys.
function historyKey(input: Input): "back" | "forward" | null {
  if (input.type !== "keyDown") return null;
  if (input.key === "BrowserBack") return "back";
  if (input.key === "BrowserForward") return "forward";
  const mac = process.platform === "darwin";
  const modifier = mac ? input.meta && !input.alt && !input.control : input.alt && !input.meta && !input.control;
  if (!modifier || input.shift) return null;
  if (input.key === "ArrowLeft" || (mac && input.key === "[")) return "back";
  if (input.key === "ArrowRight" || (mac && input.key === "]")) return "forward";
  return null;
}

function go(direction: "back" | "forward") {
  const history = window?.webContents.navigationHistory;
  if (!history) return;
  if (direction === "back" && history.canGoBack()) history.goBack();
  if (direction === "forward" && history.canGoForward()) history.goForward();
}

function createWindow(url: string) {
  window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    title: "score3ly",
    // The icon's coal tile, until the page paints (DESIGN.md §5.7).
    backgroundColor: "#303237",
    icon: join(import.meta.dirname, "web", "icon-512.png"),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const origin = new URL(url).origin;

  window.webContents.on("before-input-event", (event, input) => {
    const direction = historyKey(input);
    if (direction) {
      event.preventDefault();
      go(direction);
    }
  });
  // The mouse's side buttons (Windows, Linux) and a swipe between pages (macOS).
  window.on("app-command", (_, command) => {
    if (command === "browser-backward") go("back");
    if (command === "browser-forward") go("forward");
  });
  window.on("swipe", (_, direction) => {
    if (direction === "right") go("back");
    if (direction === "left") go("forward");
  });

  // Links to other sites (the About page's, the licences) open in the browser, never in the app's window.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) {
      event.preventDefault();
      if (/^https?:/.test(target)) void shell.openExternal(target);
    }
  });

  window.on("closed", () => (window = null));
  void window.loadURL(url);
}

// One instance: a second start shows the first one's window (both would share the database).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady().then(async () => {
    const here = import.meta.dirname;
    server = await startServer({
      dataDir: app.getPath("userData"),
      webDir: join(here, "web"),
      migrationsDir: join(here, "migrations"),
      host: "desktop",
      openSecretsFile: (path) => void shell.openPath(path),
    });
    createWindow(server.url);
    // macOS: clicking the dock icon with no window open opens one.
    app.on("activate", () => {
      if (!window && server) createWindow(server.url);
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    void server?.close();
  });
}
