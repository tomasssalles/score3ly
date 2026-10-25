// The themes (DESIGN.md §5.7): their colours are in themes.css, one block per theme. Which one is shown is a device
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
  for (const listener of listeners) listener(theme);
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
}

export const CHOICES: { value: ThemeChoice; label: string }[] = [{ value: "auto", label: "Auto" }, ...THEMES.map((t) => ({ value: t.id, label: t.label }))];
