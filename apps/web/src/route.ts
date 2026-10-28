// The open project is part of the URL, as "#/projects/<id>", and so is what the user picked to look at: an
// artifact, as "#/projects/<id>/artifacts/<artifact id>", or a stage's details, as "#/projects/<id>/stages/<stage
// id>". The pages in the menu have their own URLs ("#/settings", ...), and the Statistics page's tabs theirs
// ("#/stats/usage"; "#/stats" is the first tab). Any other URL means no project is open.

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
export type StatsTab = (typeof STATS_TABS)[number];

export function pageFromHash(hash: string): Page | null {
  const match = /^#\/([a-z]+)(?:\/([a-z]+))?$/.exec(hash);
  if (!match || !(PAGES as readonly string[]).includes(match[1])) return null;
  if (match[2] !== undefined && !(match[1] === "stats" && (STATS_TABS as readonly string[]).includes(match[2]))) return null;
  return match[1] as Page;
}

// The tab of the Statistics page a hash opens: the first one unless it names another.
export function statsTabFromHash(hash: string): StatsTab {
  const tab = /^#\/stats\/([a-z]+)$/.exec(hash)?.[1];
  return tab && (STATS_TABS as readonly string[]).includes(tab) ? (tab as StatsTab) : STATS_TABS[0];
}

export function hashForStatsTab(tab: StatsTab): string {
  return `#/stats/${tab}`;
}

export function hashForPage(page: Page): string {
  return `#/${page}`;
}
