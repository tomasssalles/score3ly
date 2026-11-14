import type { Fingerprint } from "@score3ly/imaging";
import type { Timing } from "./itemTiming";
import { type CallEvent, readSse, sha256Hex } from "@score3ly/core";

// Mirrors the Worker's Project type (apps/worker/src/index.ts).
export type { ListedProject, PipelinePosition, Project, RunMode } from "@score3ly/core";
import type { ListedProject, Project, RunMode } from "@score3ly/core";

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
  modelConfig: { name: string; model: string; deleted: boolean; unsupported: boolean } | null; // LLM stages: the model config it names
  costUsd: number | null; // what its LLM calls cost, VAT included (docs/llm.md, "VAT")
  carried: boolean; // a manual stage carried through a re-run, waiting for its turn to be kept or dropped (§5.5)
  inRecipe: boolean; // part of the recipe, or added by the user (a further review and its Apply review, a manual stage)
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

// A failed request. `status` is the HTTP status, so callers can react to e.g. 409 (conflict); `code` the Worker's
// code for it, where it gives one.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super(`HTTP ${status}`);
    this.status = status;
    this.code = code;
  }

  // The project changed elsewhere since this page read it (optimistic locking): the change was refused.
  get stale(): boolean {
    return this.code === "stale_version";
  }
}

// Fired when the Worker refused a change because the project changed elsewhere; the app offers to reload.
export const STALE_EVENT = "score3ly:stale-project";

async function checked(response: Response): Promise<Response> {
  if (!response.ok) {
    const code = response.status === 409 ? (((await response.clone().json().catch(() => null)) as { code?: string } | null)?.code ?? null) : null;
    if (code === "stale_version") window.dispatchEvent(new Event(STALE_EVENT));
    throw new ApiError(response.status, code);
  }
  return response;
}

// Optimistic locking (docs/database.md, "Optimistic locking"): the last version of each project this page saw, sent
// with every request about the project and taken from every answer. The Worker checks it on a person's changes.
const VERSION_HEADER = "X-Project-Version";
const versions = new Map<string, string>();

async function projectFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const id = /^\/api\/projects\/([^/?]+)/.exec(url)?.[1];
  const headers = new Headers(init.headers);
  const known = id ? versions.get(id) : undefined;
  if (known !== undefined) headers.set(VERSION_HEADER, known);
  const response = await fetch(url, { ...init, headers });
  const current = response.headers.get(VERSION_HEADER);
  if (id && current !== null && response.ok) versions.set(id, current);
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

// All projects, most recently opened first, each with where its pipeline is (for the home's cards).
export async function listProjects(): Promise<ListedProject[]> {
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
  await checked(await projectFetch(`/api/projects/${project.id}/opened`, { method: "POST" }));
}

// Renames a project. Fails with status 409 if another project already has that name (ignoring case).
export async function renameProject(project: Project, name: string): Promise<Project> {
  const response = await projectFetch(`/api/projects/${project.id}`, {
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
  const response = await projectFetch(`/api/projects/${project.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runMode }),
  });
  return (await checked(response)).json();
}

// The project's stages in order, with their outputs.
export async function fetchPipeline(project: Project): Promise<ApiPipeline> {
  return (await checked(await projectFetch(`/api/projects/${project.id}/pipeline`))).json();
}

// Running stages (the browser does the work, the Worker records it; apps/worker/src/pipeline.ts).

function stageUrl(project: Project, stageId: string, action: string): string {
  return `/api/projects/${project.id}/stages/${stageId}/${action}`;
}

async function send(url: string, body?: unknown, method = "POST"): Promise<Response> {
  return checked(
    await projectFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

// Sets a stage's config (null: the defaults). A stage that has run is replaced, with the stages after it.
// `applyModelConfigToLater`: the LLM stages after this one get its model config too, and nothing else (docs/llm.md).
export async function setStageConfig(project: Project, stageId: string, config: unknown, applyModelConfigToLater = false): Promise<ApiPipeline> {
  return (await send(stageUrl(project, stageId, "config"), { config, applyModelConfigToLater }, "PUT")).json();
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
  timing?: Timing; // a running stage's items: how long it took, what it found in the caches (itemTiming.ts)
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

// Adds a further review after an Apply review, with an Apply review of its own (docs/stages/music.md, `apply_review`).
export async function addReviewStage(project: Project, afterStageId: string): Promise<{ stageId: string; pipeline: ApiPipeline }> {
  return (await send(stageUrl(project, afterStageId, "review"))).json();
}

// Adds a human review after a done Apply review, WIP, with an Apply review of its own (docs/stages/music.md,
// `human_review`).
export async function addHumanReviewStage(
  project: Project,
  afterStageId: string,
  start: Omit<FixStart, "step">,
): Promise<{ stageId: string; pipeline: ApiPipeline }> {
  return (await send(stageUrl(project, afterStageId, "human-review"), start)).json();
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
  return (await checked(await projectFetch(`/api/projects/${project.id}/dropped/${id}`, { method: "DELETE" }))).json();
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

export type Provider = "anthropic" | "bedrock" | "ai-studio" | "vertex" | "openrouter" | "fake" | "fake-dev";
// An OpenRouter account's plan: its fee on credit purchases, and the EU for Business only.
export type Account = "standard" | "business";
export type Family = "claude" | "gemini" | "fake";

// A model config (docs/llm.md, "Configs"), with what the list of models says about its model.
export type ModelConfig = {
  id: string;
  name: string; // required and unique (docs/llm.md, "Model configs")
  provider: Provider;
  modelId: string | null; // a listed model
  modelString: string | null; // or a model added by hand
  model: string; // the model's string on the provider
  family: Family;
  modelName: string | null; // a listed model's name for people
  // Why the app no longer supports it, said after its name, or null: its stages can't start, and it can't be picked
  // (docs/llm.md, "No longer supported").
  unsupported: string | null;
  effort: "low" | "medium" | "high" | "xhigh" | "max" | null;
  region: string; // "" where the provider has no regions
  routing: "global" | "geographic" | "in-region" | null; // Bedrock only
  project: string | null; // Vertex AI only
  account: Account | null; // OpenRouter only
  secrets: Record<string, string>; // field → name of a Worker secret
  pricing: { kind: "list"; reference: string | null } | { kind: "free" } | { kind: "unpriced" } | { kind: "provider" };
  // What its calls cost now: per million tokens, perhaps borrowed from another model (its name).
  price:
    | { kind: "priced"; price: { input: number; output: number; cacheRead: number; cacheWrite: number }; borrowedFrom: string | null }
    | { kind: "free" }
    | { kind: "unpriced" }
    | { kind: "provider"; fee: number } // each answer says what it cost; plus the fee on credits
    | { kind: "missing" };
  freeTier: boolean; // pricing "free"
  createdAt: string;
  deletedAt: string | null; // a deleted config is never used again
};

// `defaultModelConfigId` is never null once the database is set up (the Worker refuses to remove it);
// null only as a guard against a database edited by hand.
// vatPercent: the VAT added to every cost, a percentage (docs/llm.md, "VAT"); the model configs' prices are without it.
export type Settings = { defaultModelConfigId: string | null; spendingCapUsd: number; newProjectRunMode: RunMode; vatPercent: number };

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
  // outcome: the calls' status as the costs view tells them apart (costs.ts, STATUSES)
  points: [stageId: string, configId: string, t: number, usd: number, outcome: string][];
  unknown: [stageId: string, configId: string, t: number, calls: number][];
  // The configs' test requests, apart from the rest: [start of the quarter of an hour in ms, US dollars, calls].
  tests: [t: number, usd: number, calls: number][];
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
  configs: {
    id: string;
    name: string | null;
    provider: Provider;
    model: string;
    // The model, whatever the provider (docs/statistics.md): a listed model's id, or "string:" and a model added by hand.
    modelKey: string;
    modelLabel: string;
    family: Family;
    modelName: string | null;
    effort: ModelConfig["effort"];
    createdAt: string;
    deletedAt: string | null;
  }[];
};

// When the app was in use (apps/worker/src/activity.ts): the quarters of an hour with any activity, per project.
export type ActivityData = {
  quarters: [projectId: string, t: number][];
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null }[];
};

// The Usage tab's projects (apps/worker/src/projectStats.ts): every project, whether it is deleted and whether its
// pipeline is finished now, and the distinct pages processed (rasterized), each page of a PDF once.
export type ProjectStats = {
  projects: { id: string; createdAt: string; deleted: boolean; finished: boolean }[];
  pagesProcessed: number;
};

export async function fetchProjectStats(): Promise<ProjectStats> {
  return (await checked(await fetch("/api/project-stats"))).json();
}

// The Usage tab's failed calls (apps/worker/src/failures.ts): every call, per model config, quarter of an hour and
// reason ("ok" for one that succeeded), and the configs they were made with.
export type FailureData = {
  points: [configId: string, t: number, reason: string, calls: number][];
  configs: { id: string; name: string | null; model: string; modelKey: string; modelLabel: string; createdAt: string; deletedAt: string | null }[];
};

export async function fetchFailures(): Promise<FailureData> {
  return (await checked(await fetch("/api/failures"))).json();
}

// The Run times (apps/worker/src/runTimes.ts): the finished projects, the stages created in them that started, with how
// many items of each kind they have, the items of the automatic ones that were timed, and the model configs the stages
// used.
export type RunTimeData = {
  recipe: string[]; // the recipe's steps but Ingest
  // pipeline: the stages of the project's final pipeline, in order
  projects: { id: string; name: string; createdAt: string; deletedAt: string | null; finishedAt: string; pages: number[]; pipeline: string[] }[];
  stages: {
    id: string;
    step: string;
    projectId: string;
    configId: string | null;
    done: boolean;
    manual: boolean; // timed from its creation to its finish
    inRecipe: boolean; // the recipe's, or added by the user
    kept: boolean; // in a pipeline: not replaced or stopped
    replacesStageId: string | null; // a manual stage: the one it replaced by being edited
    activeQuarters: number | null; // a manual stage: its active quarters of an hour (saves, and single gaps between them)
    createdAt: string;
    finishedAt: string | null;
    pageCount: number;
    items: { whole: number; page: number; system: number };
  }[];
  items: [stageId: string, item: string, durationMs: number, calls: number, callsCached: number, images: number, imagesCached: number][];
  configs: { id: string; name: string | null; model: string; modelKey: string; modelLabel: string; createdAt: string; deletedAt: string | null }[];
};

export async function fetchRunTimes(): Promise<RunTimeData> {
  return (await checked(await fetch("/api/run-times"))).json();
}

export async function fetchActivity(): Promise<ActivityData> {
  return (await checked(await fetch("/api/activity"))).json();
}

export async function fetchCosts(): Promise<CostData> {
  return (await checked(await fetch("/api/costs"))).json();
}

// An image is named by its recipe key (docs/overview.md §5.2, "Only recipes, never pixels, in any key"), and comes with its
// bytes only once the Worker has said the call isn't cached (llm.ts, `ask`). `cacheUpTo`: the prompt up to and
// including this part is worth caching at the provider (docs/llm.md, "Prompt caching"); at most 4 per request.
export type LlmContent = (
  | { type: "text"; text: string }
  | { type: "image"; recipeKey: string; image?: { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string } }
) & { cacheUpTo?: true };

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

// A call the Worker refused to make: `code` says why (e.g. "spending_cap", "unsupported_model_config", "missing_secret").
export class LlmRefused extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// One LLM request of a running stage. The Worker serves an identical earlier answer, or makes the call. A request
// whose images come without their bytes is only looked up: if it isn't cached, the answer asks for the images.
// `label` names the call in the Worker's log ("System 12"); it isn't part of the request or its key. `signal`: the stage's
// run; stopping it cancels the call, down to the provider (docs/llm.md, "Stopped calls").
export async function callLlm(
  project: Project,
  stageId: string,
  request: LlmRequest,
  label?: string,
  signal?: AbortSignal,
  onEvent?: (event: CallEvent) => void,
): Promise<LlmAnswer | { imagesNeeded: true }> {
  const response = await fetch(stageUrl(project, stageId, "llm"), {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, ...(label ? { label } : {}) }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (body?.code) throw new LlmRefused(body.code, body.error ?? body.code);
    throw new ApiError(response.status);
  }
  if (response.headers.get("Content-Type")?.startsWith("text/event-stream")) return streamedAnswer(response, onEvent);
  return response.json();
}

// A call that was sent is streamed (docs/llm.md, "A call's progress"): its start and progress go to `onEvent` as they
// come, and its answer ends the stream.
async function streamedAnswer(response: Response, onEvent?: (event: CallEvent) => void): Promise<LlmAnswer> {
  let answer: LlmAnswer | null = null;
  let error: string | null = null;
  await readSse(response, (data) => {
    const event = JSON.parse(data) as CallEvent | { event: "answer"; answer: LlmAnswer } | { event: "error"; error: string };
    if (event.event === "answer") answer = event.answer;
    else if (event.event === "error") error = event.error;
    else onEvent?.(event);
  });
  if (answer) return answer;
  throw new Error(error ?? "The connection to the server ended before the answer came.");
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
// `known`: the issues the caller works on; the numbers continue above theirs, which may come from another project's
// counter (stages reused from the stage cache, found 2026-11-04).
export async function reserveIssueNumbers(project: Project, count: number, known: Iterable<{ id: number }> = []): Promise<number> {
  let above = 0;
  for (const issue of known) above = Math.max(above, issue.id);
  return ((await (await send(`/api/projects/${project.id}/issue-numbers`, { count, above })).json()) as { first: number }).first;
}

// What the new config form's pickers offer (apps/worker/src/llmRoutes.ts, `modelOptions`; docs/llm.md).
export type Routing = "global" | "geographic" | "in-region";
export type Place = { region: string; routing: Routing | null };
export type ModelPrice = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type ModelOptions = {
  asOf: string;
  mock: boolean;
  providers: {
    id: Provider;
    name: string;
    families: { id: Family; name: string; efforts: NonNullable<ModelConfig["effort"]>[]; secrets: string[][] }[];
    places: (Place & { geography?: string })[];
    // Priced by the provider (OpenRouter): an account's plan sets the fee, and some regions are for Business only.
    pricedByProvider?: { fees: Record<Account, number>; businessRegions: string[] };
  }[];
  models: {
    id: string;
    name: string;
    family: Family;
    efforts: NonNullable<ModelConfig["effort"]>[]; // the levels the model takes ([] for none)
    // A place's price is null where the provider prices each call itself.
    providers: Partial<Record<Provider, { string: string; places: (Place & { price: ModelPrice | null })[] }>>;
  }[];
};

export async function fetchModelOptions(): Promise<ModelOptions> {
  return (await checked(await fetch("/api/models"))).json();
}

// A guide to what a config's model costs where the provider prices each call itself (OpenRouter): the lowest and
// highest of the four prices per million tokens among those who run it, without the fee on credits, or null.
export type PriceRange = { input: [number, number]; output: [number, number]; cacheRead: [number, number]; cacheWrite: [number, number] };

export async function fetchPriceRange(configId: string): Promise<PriceRange | null> {
  return ((await (await checked(await fetch(`/api/model-configs/${configId}/price-range`))).json()) as { range: PriceRange | null }).range;
}

// The names of the Worker's secrets (never their values), for the secret pickers.
export async function fetchSecretNames(): Promise<string[]> {
  return ((await (await checked(await fetch("/api/secrets"))).json()) as { names: string[] }).names;
}

// What a new model config is made of (the Worker's `configProblem` checks it).
export type NewModelConfig = {
  name?: string;
  provider: Provider;
  modelId?: string;
  modelString?: string;
  family?: Family;
  effort: ModelConfig["effort"];
  region: string;
  routing: Routing | null;
  project?: string;
  account?: Account;
  secrets: Record<string, string>;
  pricing: ModelConfig["pricing"];
};

// Creates a model config, or clones one (`replaces`: the original, deleted with it). A refusal comes back as a
// WorkerRefusal with the Worker's message, to show in the form, and for a config with the same values as another,
// "same_values" and that config.
export async function createModelConfig(body: NewModelConfig & { replaces?: string }): Promise<ModelConfig> {
  const response = await fetch("/api/model-configs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await refusedOr(response)).json();
}

// A refusal from the Worker, with its message and, where it has one, its code and what it names (the config with the
// same values, "same_values").
export class WorkerRefusal extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly config: { id: string; name: string } | null;

  constructor(status: number, body: { error?: string; code?: string; config?: { id: string; name: string } } | null) {
    super(body?.error ?? `HTTP ${status}`);
    this.status = status;
    this.code = body?.code ?? null;
    this.config = body?.config ?? null;
  }
}

async function refusedOr(response: Response): Promise<Response> {
  if (!response.ok) throw new WorkerRefusal(response.status, await response.json().catch(() => null));
  return response;
}

// Renames a model config; a taken name is refused (WorkerRefusal with the Worker's message).
export async function renameModelConfig(id: string, name: string): Promise<ModelConfig> {
  const response = await fetch(`/api/model-configs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  return (await refusedOr(response)).json();
}

// A config's test (docs/llm.md, "The settings page"): the call's answer, the colour the model saw, and how long it took.
export type TestResult = {
  status: "ok" | "cut_off" | "refused" | "unparseable" | "error";
  error: string | null;
  costUsd: number | null; // VAT included
  durationMs: number;
};

// Sends a config's test request; refusals before anything is sent (a missing secret, the spending cap) throw.
export async function testModelConfig(id: string): Promise<TestResult> {
  return (await refusedOr(await fetch(`/api/model-configs/${id}/test`, { method: "POST" }))).json();
}

// Deletes a model config; the default is refused.
export async function deleteModelConfig(id: string): Promise<void> {
  await refusedOr(await fetch(`/api/model-configs/${id}`, { method: "DELETE" }));
}

// Exporting and importing a project (docs/database.md, "Exporting and importing a project"). The rows of the project's
// current pipeline, as the Worker hands them out (an object of the export format, `format` in it).
export type ProjectRows = Record<string, unknown> & { format: number; project: Record<string, unknown> & { name: string; pdf_sha256: string; pdf_filename: string }; content: string[] };

export async function fetchExport(project: Project): Promise<ProjectRows> {
  return (await checked(await fetch(`/api/projects/${project.id}/export`))).json();
}

export async function fetchContent(sha256: string): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const response = await checked(await fetch(`/api/content/${sha256}`));
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("Content-Type") ?? "application/octet-stream" };
}

export async function fetchPdf(sha256: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await (await checked(await fetch(`/api/pdfs/${sha256}/file`))).arrayBuffer());
}

export async function storePdf(sha256: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  await checked(await fetch(`/api/pdfs/${sha256}`, { method: "PUT", body: bytes }));
}

// Which of these content objects the Worker doesn't have yet (asked at most 200 at a time, as the Worker wants).
export async function missingContent(sha256s: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (let i = 0; i < sha256s.length; i += 200) {
    const response = await fetch("/api/content/missing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha256s: sha256s.slice(i, i + 200) }) });
    missing.push(...((await (await checked(response)).json()) as { missing: string[] }).missing);
  }
  return missing;
}

// Imports the rows (the PDF and the content uploaded first). Refusals come with the Worker's own message.
export async function importRows(rows: ProjectRows): Promise<{ id: string; name: string }> {
  const response = await fetch("/api/projects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows) });
  if (!response.ok) {
    const error = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    throw new Error(error ?? `HTTP ${response.status}`);
  }
  return response.json();
}
