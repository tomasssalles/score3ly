// The themes (docs/style.md): their colours are in themes.css, one block per theme. Which one is shown is a device
// setting (§5.8): Auto (the default) follows the system's light or dark preference where there is a theme for it, or
// a theme picked by name.

export type Theme = { id: string; label: string; dark: boolean };

export const THEMES: Theme[] = [
  { id: "dark", label: "Dark", dark: true },
  { id: "light", label: "Light", dark: false },
];

export type ThemeChoice = "auto" | string;

const KEY = "score3ly.theme";

export function themeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    // No storage (e.g. some private windows): Auto.
  }
  return "auto";
}

// Auto: the first theme that matches the system's preference, else the first theme.
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice !== "auto") return THEMES.find((t) => t.id === choice) ?? THEMES[0];
  return THEMES.find((t) => t.dark === prefersDark) ?? THEMES[0];
}

const darkQuery = () => (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null);

export function currentTheme(): Theme {
  return resolveTheme(themeChoice(), darkQuery()?.matches ?? true);
}

// Called with the theme whenever it is applied (e.g. the desktop app's window frame follows it).
const listeners: ((theme: Theme) => void)[] = [];

export function onThemeApplied(listener: (theme: Theme) => void) {
  listeners.push(listener);
  listener(currentTheme());
}

// Shows the chosen theme: themes.css applies the block of `data-theme` on the document.
export function applyTheme() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme.id;
  showBarColor();
  for (const listener of listeners) listener(theme);
}

// The installed app's bar (the title bar on a desktop, the status bar on Android) in the theme's accent
// (docs/style.md, "Brand"): a `theme-color` meta tag overrides the manifest's `theme_color`, which stays as the colour
// before the script runs. The colour is read from the theme's CSS, so it is named only in themes.css.
function showBarColor() {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  if (!accent) return; // the stylesheet isn't loaded yet: shown again on load
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = accent;
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Not kept: it applies until the page is reloaded.
  }
  applyTheme();
}

// At startup: the theme, and again whenever the system's preference changes (it matters for Auto).
export function startThemes() {
  applyTheme();
  darkQuery()?.addEventListener("change", applyTheme);
  window.addEventListener("load", showBarColor);
}

export const CHOICES: { value: ThemeChoice; label: string }[] = [{ value: "auto", label: "Auto" }, ...THEMES.map((t) => ({ value: t.id, label: t.label }))];
