// The desktop app's main process (DESIGN.md §3, "Desktop version"): starts the server (server.ts) on 127.0.0.1 with
// the data in the app's data folder, and shows it in a window. The web app is the same as on Cloudflare; what Electron
// adds is what a browser would: back and forward by keyboard, mouse and swipe, links opening in the browser.

import { app, BrowserWindow, Menu, nativeTheme, shell, type Input } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startServer, type RunningServer, type WindowTheme } from "./server.ts";

// The data folder is named after the app, not the package ("desktop").
app.setName("score3ly");

const ICON = join(import.meta.dirname, "web", "icon-cadenza-512.png");

// Cadenza's splash: its icon's light grey tile, until the page paints (DESIGN.md §3, "Editions").
const SPLASH = "#dfe1e5";

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

// The window's frame, drawn by the system, follows the app's theme rather than the system's setting (§3): the page
// says which (POST /api/window/theme), and the last one is kept for the next start, so the frame is right at once.
function themeFile(): string {
  return join(app.getPath("userData"), "window-theme.json");
}

function restoreWindowTheme() {
  try {
    const { theme } = JSON.parse(readFileSync(themeFile(), "utf8")) as { theme?: unknown };
    if (theme === "system" || theme === "dark" || theme === "light") nativeTheme.themeSource = theme;
  } catch {
    // First start: the system's setting, until the page says.
  }
}

function setWindowTheme(theme: WindowTheme) {
  nativeTheme.themeSource = theme;
  try {
    writeFileSync(themeFile(), JSON.stringify({ theme }));
  } catch {
    // Not kept: the next start shows the system's setting until the page says.
  }
}

function go(direction: "back" | "forward") {
  const history = window?.webContents.navigationHistory;
  if (!history) return;
  if (direction === "back" && history.canGoBack()) history.goBack();
  if (direction === "forward" && history.canGoForward()) history.goForward();
}

// No menu bar (DESIGN.md §3): the app has its own header and menu. macOS always has the global menu bar, so there
// it keeps a minimal one: the app's menu (Quit), Edit, which gives text fields copy and paste by keyboard there, and
// Window.
function setMenu() {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

function createWindow(url: string) {
  window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    title: "score3ly",
    backgroundColor: SPLASH,
    // The cadenza edition's icon (DESIGN.md §3, "Editions"): the window's, and the taskbar's on Windows and Linux.
    icon: ICON,
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
    // macOS takes the dock's icon from the app bundle; running from the repository there is none, so it is set here.
    app.dock?.setIcon(ICON);
    restoreWindowTheme();
    setMenu();
    const here = import.meta.dirname;
    server = await startServer({
      dataDir: app.getPath("userData"),
      webDir: join(here, "web"),
      migrationsDir: join(here, "migrations"),
      host: "desktop",
      openSecretsFile: (path) => void shell.openPath(path),
      setWindowTheme,
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
