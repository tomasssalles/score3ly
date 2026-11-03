// Leaving a project while this device runs one of its stages (docs/project-view.md, "Leaving a running project"):
// the run belongs to the project view, so leaving the project inside the app (a page of the menu, another project,
// the back button) stops it. The view says here which project runs; the app asks before a change of the URL leaves
// it. What doesn't need React is here, the dialog is the app's.

import { parseRoute, pageFromHash } from "./route.ts";

let running: string | null = null;

// The project whose stage this device runs, or null.
export function setRunningProject(projectId: string | null): void {
  running = projectId;
}

export function runningProject(): string | null {
  return running;
}

// Whether going to `hash` leaves the project `projectId`: a page of the menu, another project, or none. Another
// artifact or a stage's details of the same project don't.
export function leavesProject(hash: string, projectId: string): boolean {
  return pageFromHash(hash) !== null || parseRoute(hash)?.projectId !== projectId;
}
