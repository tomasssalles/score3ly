import type { Fingerprint } from "@score3ly/imaging";
import { sha256Hex } from "@score3ly/core";

// Mirrors the Worker's Project type (apps/worker/src/index.ts).
export type { Project, RunMode } from "@score3ly/core";
import type { Project, RunMode } from "@score3ly/core";

// Mirrors the Worker's Pipeline, Stage and Output types: the stages as stored (docs/database.md).
export type ApiPipeline = { stages: ApiStage[]; dropped: ApiDropped[] };

// A manual stage dropped at its turn because its inputs changed: a card where it was, after the stage with
// `afterStageId`, until dismissed (docs/overview.md §5.5).
export type ApiDropped = { id: number; afterStageId: string; step: string };

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
  modelConfig: { name: string | null; model: string } | null; // LLM stages: the model config used
  costUsd: number | null; // what its LLM calls cost
  carried: boolean; // a manual stage carried through a re-run, waiting for its turn to be kept or dropped (§5.5)
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

// Which host serves the app (docs/desktop.md, "What differs in the app"): Cloudflare, the desktop app (Electron) or the
// same server run alone on a computer.
export type Host = "cloudflare" | "desktop" | "local";

export async function fetchHost(): Promise<Host> {
  return ((await (await checked(await fetch("/api/info"))).json()) as { host: Host }).host;
}

// The desktop app: opens the secrets file in the system's text editor (the server does it; a page can't).
export async function openSecretsFile(): Promise<void> {
  await checked(await fetch("/api/secrets-file/open", { method: "POST" }));
}

// The desktop app: the window's frame, drawn by the system, in the app theme's light or dark, or the system's for
// Auto (docs/desktop.md).
export type WindowTheme = "system" | "dark" | "light";

export async function setWindowTheme(theme: WindowTheme): Promise<void> {
  await checked(await fetch("/api/window/theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) }));
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

// Deletes a project (docs/database.md, "Deleting a project"). Refused (409) while one of its stages runs. Says whether no project left uses
// its PDF, so that this device can delete the PDF's images too.
export async function deleteProject(project: Project): Promise<{ pdfUnused: boolean }> {
  return (await checked(await fetch(`/api/projects/${project.id}`, { method: "DELETE" }))).json();
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
  modelConfigId?: string | null; // LLM stages: the model config the stage uses
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
  callId?: string; // LLM outputs: the call whose answer it is
  parentOutputId?: string; // manual outputs: the output they correct
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

// Manual stages (docs/overview.md §5.4, docs/project-view.md).

export type FixStart = { step: string; stepVersion: number; pageCount: number | null; inputIds: string[] };

// Adds a manual stage, WIP, after a done stage. The stages after it are replaced.
export async function addFixStage(
  project: Project,
  afterStageId: string,
  start: FixStart,
): Promise<{ stageId: string; pipeline: ApiPipeline }> {
  return (await send(stageUrl(project, afterStageId, "fix"), start)).json();
}

// Edits a finished manual stage: a WIP copy takes its place.
export async function editStage(project: Project, stageId: string): Promise<{ stageId: string; pipeline: ApiPipeline }> {
  return (await send(stageUrl(project, stageId, "edit"))).json();
}

export async function dropStage(project: Project, stageId: string): Promise<ApiPipeline> {
  return (await send(stageUrl(project, stageId, "drop"))).json();
}

// Dismisses the card of a dropped stage.
export async function dismissDropped(project: Project, id: number): Promise<ApiPipeline> {
  return (await checked(await fetch(`/api/projects/${project.id}/dropped/${id}`, { method: "DELETE" }))).json();
}

// A carried manual stage whose turn has come: kept if `inputIds` (what it would read now) hold what it read, else
// dropped (docs/overview.md §5.5).
export async function resolveStage(project: Project, stageId: string, inputIds: string[]): Promise<{ kept: boolean; pipeline: ApiPipeline }> {
  return (await send(stageUrl(project, stageId, "resolve"), { inputIds })).json();
}

// Stored content (docs/overview.md §2): uploaded under the SHA-256 of its bytes, which is returned. Uploading the same
// content again is harmless.
export async function putContent(bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<string> {
  const sha256 = await sha256Hex(bytes);
  await checked(await fetch(`/api/content/${sha256}`, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes }));
  return sha256;
}

export async function fetchJsonContent(sha256: string): Promise<unknown> {
  return (await checked(await fetch(`/api/content/${sha256}`))).json();
}

export async function fetchTextContent(sha256: string): Promise<string> {
  return (await checked(await fetch(`/api/content/${sha256}`))).text();
}

// LLM calls (apps/worker/src/llmRoutes.ts, docs/llm.md).

export type ModelConfig = {
  id: string;
  name: string | null;
  provider: "anthropic" | "anthropic-vertex" | "anthropic-bedrock" | "google" | "fake";
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max" | null;
  params: Record<string, string>;
  secrets: Record<string, string>; // field → name of a Worker secret
  freeTier: boolean;
  supersedesId: string | null;
  createdAt: string;
};

export type Settings = { defaultModelConfigId: string | null; spendingCapUsd: number; newProjectRunMode: RunMode };

export async function fetchSettings(): Promise<Settings> {
  return (await checked(await fetch("/api/settings"))).json();
}

// Sets one setting; returns them all.
export async function putSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Settings> {
  const response = await fetch(`/api/settings/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  return (await checked(response)).json();
}

// The model configs that aren't deleted, oldest first.
export async function fetchModelConfigs(): Promise<ModelConfig[]> {
  return (await checked(await fetch("/api/model-configs"))).json();
}

export async function fetchModelConfig(id: string): Promise<ModelConfig> {
  return (await checked(await fetch(`/api/model-configs/${id}`))).json();
}

// The costs view's data (apps/worker/src/costs.ts): what was paid for, per stage, model config and quarter of an hour,
// with the stages, projects and configs it refers to, and the spending cap's last 24 hours. The paid calls of unknown
// cost are counted the same way.
export type CostData = {
  capUsd: number;
  spentLastDayUsd: number;
  points: [stageId: string, configId: string, t: number, usd: number][];
  unknown: [stageId: string, configId: string, t: number, calls: number][];
  stages: { id: string; step: string; projectId: string; inRecipe: boolean; kept: boolean }[];
  // Every project, for the average per page too: whether its pipeline ran to its end, what it cost in all, the pages
  // its `rasterize` stages selected.
  projects: {
    id: string;
    name: string;
    pdfSha256: string;
    pdfFilename: string;
    createdAt: string;
    deletedAt: string | null;
    finished: boolean;
    costUsd: number;
    pages: number[];
  }[];
  configs: { id: string; name: string | null; provider: ModelConfig["provider"]; model: string; effort: ModelConfig["effort"]; createdAt: string; deletedAt: string | null }[];
};

// When the app was in use (apps/worker/src/activity.ts): the quarters of an hour with any activity, per project.
export type ActivityData = {
  quarters: [projectId: string, t: number][];
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null }[];
};

export async function fetchActivity(): Promise<ActivityData> {
  return (await checked(await fetch("/api/activity"))).json();
}

export async function fetchCosts(): Promise<CostData> {
  return (await checked(await fetch("/api/costs"))).json();
}

// An image is named by its recipe key (docs/overview.md §5.2, "Only recipes, never pixels, in any key"), and comes with its
// bytes only once the Worker has said the call isn't cached (llm.ts, `ask`).
export type LlmContent =
  | { type: "text"; text: string }
  | { type: "image"; recipeKey: string; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string } };

export type LlmRequest = {
  system?: string;
  messages: { role: "user" | "assistant"; content: LlmContent[] }[];
  maxOutputTokens?: number;
  jsonSchema?: Record<string, unknown>;
};

export type LlmAnswer = {
  callId: string;
  cached: boolean; // served from an earlier identical request: nothing was paid
  status: "ok" | "cut_off" | "refused" | "unparseable" | "error";
  text: string | null;
  json: unknown;
  error: string | null;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } | null;
  costUsd: number | null;
};

// A call the Worker refused to make: `code` says why (e.g. "spending_cap", "no_price", "missing_secret").
export class LlmRefused extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// One LLM request of a running stage. The Worker serves an identical earlier answer, or makes the call. A request
// whose images come without their bytes is only looked up: if it isn't cached, the answer asks for the images.
export async function callLlm(project: Project, stageId: string, request: LlmRequest): Promise<LlmAnswer | { imagesNeeded: true }> {
  const response = await fetch(stageUrl(project, stageId, "llm"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (body?.code) throw new LlmRefused(body.code, body.error ?? body.code);
    throw new ApiError(response.status);
  }
  return response.json();
}

// Fingerprints of the images from which stored results were computed (apps/worker/src/fingerprints.ts, 
// docs/images.md §8.3), by the image's recipe key.
export type StoredFingerprint = Fingerprint & { recipeKey: string; pdfSha256: string };

export async function fetchFingerprint(recipeKey: string): Promise<StoredFingerprint | null> {
  return ((await (await checked(await fetch(`/api/fingerprints/${recipeKey}`))).json()) as { fingerprint: StoredFingerprint | null }).fingerprint;
}

export async function storeFingerprints(fingerprints: StoredFingerprint[]): Promise<void> {
  await send("/api/fingerprints", { fingerprints });
}

// When the LLM price table was collected (docs/llm.md, "Costs").
export async function fetchPrices(): Promise<{ asOf: string }> {
  return (await checked(await fetch("/api/prices"))).json();
}

// An answer the stage can't use although it is valid JSON: it won't be served from the cache again.
export async function markUnusable(project: Project, stageId: string, callId: string, reason: string): Promise<void> {
  await send(stageUrl(project, stageId, `llm-calls/${callId}/unusable`), { reason });
}

// Reserves `count` issue numbers for the project (docs/notation.md, "Issue ids"): never reused. Returns the first.
export async function reserveIssueNumbers(project: Project, count: number): Promise<number> {
  return ((await (await send(`/api/projects/${project.id}/issue-numbers`, { count })).json()) as { first: number }).first;
}
