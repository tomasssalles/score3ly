// The home (docs/project-view.md, "The home"): cards of the most recently opened projects, each saying where its
// pipeline is in the words of the panel's head ("Done", "Extract failed", "Human review (WIP)").

import type { ListedProject, PipelinePosition } from "./api";
import { type LabelState, STALE_MS } from "./pipeline.ts";
import { stepInfo } from "./steps.ts";

// How many projects the home shows; the picker has them all.
export const HOME_CARDS = 8;

export function recentProjects(projects: ListedProject[]): ListedProject[] {
  return projects.slice(0, HOME_CARDS);
}

// Where a pipeline is, as the panel's head would say it, from where the Worker says it is. A carried stage waits for its
// turn; a stopped one can run again, like a failed one; a running one whose heartbeat stopped was interrupted. Nothing
// runs on this device while the home is shown: leaving a project stops its run.
export function positionState(current: PipelinePosition | null, now = Date.now()): LabelState {
  if (!current) return { kind: "done" };
  const title = stepInfo(current.step).title;
  if (current.carried) return { kind: "waiting", stage: { title, status: "planned" } };
  switch (current.status) {
    case "running":
      return current.heartbeatAt === null || now - Date.parse(current.heartbeatAt) > STALE_MS
        ? { kind: "failed", stage: { title }, interrupted: true }
        : { kind: "running", stage: { title } };
    case "failed":
    case "stopped":
      return { kind: "failed", stage: { title }, interrupted: false };
    case "wip":
      return { kind: "waiting", stage: { title, status: "wip" } };
    default:
      return { kind: "waiting", stage: { title, status: "planned" } };
  }
}
