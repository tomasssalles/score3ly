// Mirrors the Worker's Project type (apps/worker/src/index.ts).
export type Project = {
  id: string;
  name: string;
  pdfSha256: string;
  pdfFilename: string;
  createdAt: string;
  lastModifiedAt: string;
  lastOpenedAt: string;
  runMode: RunMode;
};

export type RunMode = "auto" | "manual";

// Mirrors the Worker's Pipeline, Stage and Output types: the stages as stored (DESIGN.md §5.8).
export type ApiPipeline = { stages: ApiStage[] };

export type ApiStage = {
  id: string;
  step: string;
  stepVersion: number | null;
  status: "planned" | "running" | "failed" | "done" | "wip" | "stopped";
  config: Record<string, unknown> | null;
  pageCount: number | null;
  error: string | null;
  note: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  outputs: ApiOutput[];
};

export type ApiOutput = {
  id: string;
  item: string;
  type: string;
  contentSha256: string | null;
  recipeKey: string | null;
  recipe: unknown;
};

// A failed request. `status` is the HTTP status, so callers can react to e.g. 409 (conflict).
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

async function checked(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response;
}

// All projects, most recently opened first.
export async function listProjects(): Promise<Project[]> {
  return (await checked(await fetch("/api/projects"))).json();
}

export type PdfLookup = {
  projects: Project[]; // most recently opened first
  newProjectName: string; // the name a new project would get
};

// What the Worker knows about a PDF, before uploading it.
export async function lookUpPdf(sha256: string, filename: string): Promise<PdfLookup> {
  const query = new URLSearchParams({ filename });
  return (await checked(await fetch(`/api/pdfs/${sha256}?${query}`))).json();
}

// Creates a project on a PDF. The file is uploaded unless the Worker already has it.
export async function createProject(pdf: File, sha256: string, alreadyStored: boolean): Promise<Project> {
  const form = new FormData();
  if (alreadyStored) {
    form.append("filename", pdf.name);
  } else {
    form.append("pdf", pdf);
  }
  form.append("sha256", sha256);
  return (await checked(await fetch("/api/projects", { method: "POST", body: form }))).json();
}

export async function markOpened(project: Project): Promise<void> {
  await checked(await fetch(`/api/projects/${project.id}/opened`, { method: "POST" }));
}

// Renames a project. Fails with status 409 if another project already has that name (ignoring case).
export async function renameProject(project: Project, name: string): Promise<Project> {
  const response = await fetch(`/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return (await checked(response)).json();
}

export async function setRunMode(project: Project, runMode: RunMode): Promise<Project> {
  const response = await fetch(`/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runMode }),
  });
  return (await checked(response)).json();
}

// The project's stages in order, with their outputs.
export async function fetchPipeline(project: Project): Promise<ApiPipeline> {
  return (await checked(await fetch(`/api/projects/${project.id}/pipeline`))).json();
}

// Running stages (the browser does the work, the Worker records it; apps/worker/src/pipeline.ts).

function stageUrl(project: Project, stageId: string, action: string): string {
  return `/api/projects/${project.id}/stages/${stageId}/${action}`;
}

async function send(url: string, body?: unknown, method = "POST"): Promise<Response> {
  return checked(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

// Sets a stage's config (null: the defaults). A stage that has run is replaced, with the stages after it.
export async function setStageConfig(project: Project, stageId: string, config: unknown): Promise<ApiPipeline> {
  return (await send(stageUrl(project, stageId, "config"), { config }, "PUT")).json();
}

export type StageStart = {
  stepVersion: number;
  config: unknown;
  stageKey: string;
  pageCount: number | null;
  inputIds: string[];
};

// Starts a stage. If a finished stage has the same key, the pipeline uses it instead: `reused`.
export async function startStage(
  project: Project,
  stageId: string,
  start: StageStart,
): Promise<{ reused: boolean; stageId: string }> {
  return (await send(stageUrl(project, stageId, "start"), start)).json();
}

export type NewOutput = {
  item: string;
  type: string;
  contentSha256?: string;
  recipeKey?: string;
  recipe?: unknown;
  inputIds?: string[];
};

export async function recordOutputs(project: Project, stageId: string, outputs: NewOutput[]): Promise<string[]> {
  return ((await (await send(stageUrl(project, stageId, "outputs"), { outputs })).json()) as { ids: string[] }).ids;
}

export async function sendHeartbeat(project: Project, stageId: string): Promise<void> {
  await send(stageUrl(project, stageId, "heartbeat"));
}

export async function finishStage(
  project: Project,
  stageId: string,
  result: { status: "done"; note?: string } | { status: "failed"; error: string },
): Promise<void> {
  await send(stageUrl(project, stageId, "finish"), result);
}

// Stops a running stage: a planned one with the same config takes its place.
export async function stopStage(project: Project, stageId: string): Promise<ApiPipeline> {
  return (await send(stageUrl(project, stageId, "stop"))).json();
}
