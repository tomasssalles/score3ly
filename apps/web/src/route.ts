// The open project is part of the URL, as "#/projects/<id>", and so is an artifact the user picked to look at,
// as "#/projects/<id>/artifacts/<artifact id>". Any other URL means no project is open.

export type Route = { projectId: string; artifactId: string | null };

export function parseRoute(hash: string): Route | null {
  const match = /^#\/projects\/([^/]+)(?:\/artifacts\/([^/]+))?$/.exec(hash);
  return match ? { projectId: match[1], artifactId: match[2] ?? null } : null;
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
