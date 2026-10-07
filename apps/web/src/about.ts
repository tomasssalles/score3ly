// Facts shown on the About page.

export const AUTHOR = "Tomás Silveira Salles";
export const REPOSITORY_URL = "https://github.com/tomasssalles/score3ly";

export type BuildInfo = {
  version: string; // from the root package.json
  commit: string | null; // short hash, or null if git wasn't available at build time
  dirty: boolean; // built with uncommitted changes
  dev: boolean; // served by the development server
};

// "0.1.0 · commit 61c081d", plus notes for builds that don't match a commit exactly.
export function versionText({ version, commit, dirty, dev }: BuildInfo): string {
  let text = version;
  if (commit !== null) text += ` · commit ${commit}${dirty ? " with uncommitted changes" : ""}`;
  if (dev) text += " · development server";
  return text;
}
