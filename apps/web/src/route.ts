// The open project is part of the URL, as "#/projects/<id>". Any other URL means no project is open.

export function projectIdFromHash(hash: string): string | null {
  const match = /^#\/projects\/([^/]+)$/.exec(hash);
  return match ? match[1] : null;
}

export function hashForProject(id: string): string {
  return `#/projects/${id}`;
}
