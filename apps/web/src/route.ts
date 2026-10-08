// The open project is part of the URL, as "#/projects/<id>", and so is what the user picked to look at: an
// artifact, as "#/projects/<id>/artifacts/<artifact id>", or a stage's details, as "#/projects/<id>/stages/<stage
// id>". The pages in the menu have their own URLs ("#/settings", ...). Any other URL means no project is open.

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

export function pageFromHash(hash: string): Page | null {
  const match = /^#\/([a-z]+)$/.exec(hash);
  return match && (PAGES as readonly string[]).includes(match[1]) ? (match[1] as Page) : null;
}

export function hashForPage(page: Page): string {
  return `#/${page}`;
}
