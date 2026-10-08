// Facts shown on the About page.

export const AUTHOR = "Tomás Silveira Salles";
export const REPOSITORY_URL = "https://github.com/tomasssalles/score3ly";

export type BuildInfo = {
  version: string; // from the root package.json
  commit: string | null; // short hash, or null if git wasn't available at build time
  dirty: boolean; // built with uncommitted changes
  dev: boolean; // served by the development server
};

// "0.1.0 @ 61c081d", plus "[+ uncommitted changes]" and "[dev server]" for builds that don't match a commit exactly.
// As separate parts, so a narrow screen can break the line between them but not inside one.
export function versionParts({ version, commit, dirty, dev }: BuildInfo): string[] {
  const parts = [commit === null ? version : `${version} @ ${commit}`];
  if (commit !== null && dirty) parts.push("[+ uncommitted changes]");
  if (dev) parts.push("[dev server]");
  return parts;
}

export function versionText(build: BuildInfo): string {
  return versionParts(build).join(" ");
}
