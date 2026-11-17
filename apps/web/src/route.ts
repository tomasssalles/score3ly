// The open project is part of the URL, as "#/projects/<id>", and so is what the user picked to look at: an
// artifact, as "#/projects/<id>/artifacts/<artifact id>", or a stage's details, as "#/projects/<id>/stages/<stage
// id>". The pages in the menu have their own URLs ("#/settings", ...), and the Statistics page's tabs theirs
// ("#/stats/usage"), and so do the Settings page's ("#/settings/configs"); a page's own URL opens its first tab. Any
// other URL means no project is open.

export type Route = { projectId: string; artifactId: string | null; stageId: string | null };

export function parseRoute(hash: string): Route | null {
  const match = /^#\/projects\/([^/]+)(?:\/(artifacts|stages)\/([^/]+))?$/.exec(hash);
  if (!match) return null;
  return {
    projectId: match[1],
    artifactId: match[2] === "artifacts" ? match[3] : null,
    stageId: match[2] === "stages" ? match[3] : null,
  };
}

export function projectIdFromHash(hash: string): string | null {
  return parseRoute(hash)?.projectId ?? null;
}

export function hashForProject(id: string): string {
  return `#/projects/${id}`;
}

export function hashForArtifact(projectId: string, artifactId: string): string {
  return `${hashForProject(projectId)}/artifacts/${artifactId}`;
}

export function hashForStage(projectId: string, stageId: string): string {
  return `${hashForProject(projectId)}/stages/${stageId}`;
}

// The pages reached from the menu, in menu order.
export const PAGES = ["stats", "settings", "help", "about"] as const;
export type Page = (typeof PAGES)[number];

// The Statistics page's tabs, in order.
export const STATS_TABS = ["costs", "usage", "times", "effort"] as const;

// The Settings page's tabs, in order (docs/project-view.md, "The menu and its pages").
export const SETTINGS_TABS = ["general", "configs"] as const;

// The pages with tabs, and their tabs.
const TABS_OF = { stats: STATS_TABS, settings: SETTINGS_TABS } as const;
export type TabbedPage = keyof typeof TABS_OF;
export type TabOf<P extends TabbedPage> = (typeof TABS_OF)[P][number];

function tabsOf(page: Page): readonly string[] {
  return (TABS_OF as Partial<Record<Page, readonly string[]>>)[page] ?? [];
}

export function pageFromHash(hash: string): Page | null {
  const match = /^#\/([a-z]+)(?:\/([a-z]+))?$/.exec(hash);
  if (!match || !(PAGES as readonly string[]).includes(match[1])) return null;
  if (match[2] !== undefined && !tabsOf(match[1] as Page).includes(match[2])) return null;
  return match[1] as Page;
}

// The tab of a page that a hash opens: the first one unless it names another.
export function tabFromHash<P extends TabbedPage>(page: P, hash: string): TabOf<P> {
  const tabs: readonly TabOf<P>[] = TABS_OF[page];
  const named = new RegExp(`^#/${page}/([a-z]+)$`).exec(hash)?.[1];
  return tabs.find((tab) => tab === named) ?? tabs[0];
}

// Whether a page's first tab has a URL of its own, or uses the page's: the Statistics page's tabs all have their own
// ("#/stats/costs"), while the Settings page's first is "#/settings" (review/fixes.md, batch 4: for the owner).
const FIRST_TAB_NAMED: Record<TabbedPage, boolean> = { stats: true, settings: false };

// A tab's hash.
export function hashForTab<P extends TabbedPage>(page: P, tab: TabOf<P>): string {
  return tab === TABS_OF[page][0] && !FIRST_TAB_NAMED[page] ? hashForPage(page) : `${hashForPage(page)}/${tab}`;
}

export function hashForPage(page: Page): string {
  return `#/${page}`;
}

// The home: no project and no page open.
export const HOME_HASH = "#/";
