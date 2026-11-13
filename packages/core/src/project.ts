// A project as the Worker's API sends it (docs/overview.md §4).
export type Project = {
  id: string;
  name: string; // unique (case-insensitive), chosen by the user; defaults to the PDF's file name
  pdfSha256: string;
  pdfFilename: string; // the file's name when the project was created
  createdAt: string; // ISO 8601, UTC
  lastModifiedAt: string; // any change to the project's own data, a rename included
  lastOpenedAt: string;
  runMode: RunMode;
};

export type RunMode = "auto" | "manual";

// Where a project's pipeline is, for the home's cards (docs/project-view.md, "The home"): its first stage that isn't
// done, as stored (a carried stage counts as not done: it waits for its turn), or null when every stage is done. The
// browser names its state as the panel's head does (`running` with an old heartbeat is an interrupted run).
export type PipelinePosition = {
  step: string;
  status: "planned" | "running" | "failed" | "wip" | "stopped" | "done";
  heartbeatAt: string | null;
  carried: boolean;
};

// A project as the list of all projects has it (`GET /api/projects`).
export type ListedProject = Project & { current: PipelinePosition | null };
