// The endpoint a running LLM stage calls once per request (docs/llm.md, "Calling the providers"), and a config's Test
// uses too: the Worker serves an identical earlier answer from the call records (the item-level cache, §5.2), and
// otherwise checks the spending cap, calls the provider, and records the call with its tokens and cost.

import type { Hono } from "hono";
import { amount, type CallAnswer, type CallEvent, type CallPlace, type CallRequest, type ErrorCode, IMAGE_MEDIA_TYPES, type ImagesNeeded, type StreamEvent, canonicalJson, fromBase64, isSha256Hex, keyOf, modelKeyOf, sha256Hex, type ModelConfig } from "@score3ly/core";
import { deferLog, logFields } from "./requestLog.ts";
import { stageEntry } from "./pipelineRules.ts";
import { badRequest, notRunning, PICK_ONE, problemText, refuse } from "./refusals.ts";
import { lock } from "./versions.ts";
import { freeOnOpenRouter } from "./llm/openrouter.ts";
import { bedrockModel, createAdapter, LlmError, type LlmContent, MAX_CACHE_MARKS } from "./llm/index.ts";
import type { LlmProgress, LlmProvider, LlmResponse } from "./llm/types.ts";
import { isReplay, replayProvider } from "./llm/replay.ts";
import { cloudflareTimeoutMessage } from "./llm/types.ts";
import { llmTimeoutMs, timedOutMessage, withTimeout } from "./llm/timeouts.ts";
import { costOf, type Price } from "./llm/prices.ts";
import { configModel, FAMILY_NAMES, modelById, priceOfConfig, PROVIDER_NAMES } from "./llm/models.ts";
import { MODEL_LIST } from "./llm/modelList.ts";
import { feeOf, providerCost, spentInLastDay, withVat } from "./spending.ts";
import { readSettings } from "./settings.ts";
import { badSecretMessage, deletedWhileRunningMessage, missingSecretMessage, type ModelConfigRow, secretValues, toModelConfig, unsupportedOf } from "./modelConfigs.ts";
import { placeOf } from "./places.ts";
import { throttledProgress } from "./throttle.ts";

// A request as the browser sends it (`CallRequest` in `@score3ly/core`).

function requestProblem(request: unknown): string | null {
  const r = request as CallRequest | null;
  if (!r || typeof r !== "object") return "expected a 'request'";
  if (r.system !== undefined && typeof r.system !== "string") return "'system' must be text";
  if (!Array.isArray(r.messages) || r.messages.length === 0) return "expected 'messages'";
  for (const m of r.messages) {
    if ((m?.role !== "user" && m?.role !== "assistant") || !Array.isArray(m.content)) return "a message needs a role and content";
    for (const c of m.content) {
      const ok =
        (c?.type === "text" && typeof c.text === "string") ||
        (c?.type === "image" &&
          isSha256Hex(c.recipeKey) &&
          (c.image === undefined ||
            (typeof c.image?.base64 === "string" && (IMAGE_MEDIA_TYPES as readonly string[]).includes(c.image?.mediaType))));
      if (!ok) return "content must be text or an image named by its recipe key (PNG, JPEG or WebP, base64)";
      if (c.cacheUpTo !== undefined && c.cacheUpTo !== true) return "'cacheUpTo' must be true or left out";
    }
  }
  const marks = r.messages.flatMap((m) => m.content).filter((c) => c.cacheUpTo).length;
  if (marks > MAX_CACHE_MARKS) return `at most ${MAX_CACHE_MARKS} parts can be marked 'cacheUpTo'`;
  if (r.maxOutputTokens !== undefined && !Number.isInteger(r.maxOutputTokens)) return "'maxOutputTokens' must be a whole number";
  if (r.jsonSchema !== undefined && (typeof r.jsonSchema !== "object" || r.jsonSchema === null)) return "'jsonSchema' must be an object";
  return null;
}

// The request with each image as its recipe key alone, and without the cache marks: what the request key is made
// from. The marks change what a call costs, not what the model is given.
function keyedRequest(request: CallRequest): unknown {
  return {
    ...request,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content.map((c) => (c.type === "image" ? { type: "image", recipeKey: c.recipeKey } : { type: "text", text: c.text })),
    })),
  };
}

// The request with each image as its recipe key and the hash of its bytes: what is recorded (images aren't stored,
// §2: they are rebuilt from their recipes).
async function recordedRequest(request: CallRequest): Promise<unknown> {
  return {
    ...request,
    messages: await Promise.all(
      request.messages.map(async (m) => ({
        role: m.role,
        content: await Promise.all(
          m.content.map(async (c) =>
            c.type === "image"
              ? { type: "image", recipeKey: c.recipeKey, mediaType: c.image!.mediaType, sha256: await sha256Hex(fromBase64(c.image!.base64)) }
              : c,
          ),
        ),
      })),
    ),
  };
}

// The request as the providers take it: images inline, without their recipe keys.
function providerMessages(request: CallRequest): { role: "user" | "assistant"; content: LlmContent[] }[] {
  return request.messages.map((m) => ({
    role: m.role,
    content: m.content.map(
      (c): LlmContent =>
        c.type === "image" ? { type: "image", image: c.image!, ...(c.cacheUpTo ? { cacheUpTo: true } : {}) } : c,
    ),
  }));
}

async function putJson(bucket: R2Bucket, value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const sha256 = await sha256Hex(bytes);
  await bucket.put(`content/${sha256}`, bytes, { sha256, httpMetadata: { contentType: "application/json" } });
  return sha256;
}

// A call refused before anything is sent: the spending cap is reached (priced calls only), a secret is missing or the
// app has no adapter.
export type Refusal = { refusal: { error: string; code: ErrorCode; status: 409 | 429 } };

// A call cancelled because the browser stopped waiting for it: of unknown cost (docs/llm.md, "Stopped calls").
const ABORTED_CALL = "Stopped: the app stopped waiting for this call (Stop, or the app was closed). Whether the provider billed it is unknown.";


export const PROGRESS_INTERVAL_MS = 1000;

function progressEvent(progress: LlmProgress, startedMs: number): CallEvent {
  return { event: "progress", elapsedMs: Date.now() - startedMs, ...progress };
}

type Prepared = {
  row: ModelConfigRow;
  config: ModelConfig;
  adapter: LlmProvider;
  sentModel: string;
  priced: ReturnType<typeof priceOfConfig>;
  price: Price | null;
};

// Sends a request that wasn't served from the record, and records the call, in one piece (a config's Test; a stage's
// call is streamed, with `prepareCall` and `runCall`).
export async function sendCall(env: Env, row: ModelConfigRow, request: CallRequest, requestKey: string, stageId: string | null, place: CallPlace, timeoutMs: number, signal?: AbortSignal): Promise<CallAnswer | Refusal> {
  const prepared = await prepareCall(env, row);
  if ("refusal" in prepared) return prepared;
  return runCall(env, prepared, request, requestKey, stageId, place, timeoutMs, signal);
}

// What a call needs before anything is sent: a price, room under the spending cap, the secrets and an adapter.
async function prepareCall(env: Env, row: ModelConfigRow): Promise<Prepared | Refusal> {
  const db = env.DB;
  const config = toModelConfig(row);
  // Then what a priced call needs: a price, room under the spending cap, and the secrets. Free and unpriced calls
  // don't count towards the cap (docs/llm.md, "Models the user adds").
  const priced = priceOfConfig(MODEL_LIST, { provider: config.provider, model: configModel(row), place: { region: config.region, routing: config.routing }, pricing: config.pricing });
  // (Never "missing": that is an unsupported config, refused above.)
  const price = priced.kind === "priced" ? priced.price : null;
  if (price || priced.kind === "provider") {
    const { spendingCapUsd } = await readSettings(db);
    // A model the provider itself lists as free (OpenRouter's ":free" models: all its prices 0) costs nothing, so the
    // cap doesn't stop it (decided 2026-11-08); its calls are still recorded at what they report.
    if ((await spentInLastDay(db)) >= spendingCapUsd && !(priced.kind === "provider" && (await freeOnOpenRouter(config.model, config.region)))) {
      return { refusal: { error: `The spending cap has been reached: $${amount(spendingCapUsd)} within 24 hours. Calls already paid for are still served.`, code: "spending_cap", status: 429 } };
    }
  }
  const secrets = secretValues(config, env);
  if ("missing" in secrets) {
    return { refusal: { error: missingSecretMessage(config.name, secrets.missing as string), code: "missing_secret", status: 409 } };
  }
  // An adapter reads its secrets when it is made: one that can't be used (a key file that doesn't parse) is refused here,
  // like a missing one, before anything is sent.
  let adapter: LlmProvider | null;
  try {
    adapter = createAdapter({ provider: config.provider, family: config.family, region: config.region, project: config.project, secrets });
  } catch (err) {
    if (!(err instanceof LlmError)) throw err;
    return { refusal: { error: badSecretMessage(config.name, err.message), code: "bad_secret", status: 409 } };
  }
  if (!adapter) {
    return { refusal: { error: `The app doesn't support ${FAMILY_NAMES[config.family]} on ${PROVIDER_NAMES[config.provider]}.`, code: "unsupported", status: 409 } };
  }
  // On Bedrock the routing is a prefix of the model string sent (llm/index.ts).
  const geography = MODEL_LIST.regions.find((r) => r.provider === config.provider && r.region === config.region)?.geography;
  const sentModel = config.provider === "bedrock" ? bedrockModel(config.model, config.routing, geography) : config.model;
  return { row, config, adapter, sentModel, priced, price };
}

// Sends the call and records it. `signal`: the browser's request, which aborts when the browser stops waiting (Stop, a
// closed tab), and with it the provider's call (docs/llm.md, "Stopped calls"). `timeoutMs`: the call is stopped the
// same way when it takes longer (docs/llm.md, "Timeouts"). `onEvent` hears of the call's start and progress (docs/llm.md,
// "A call's progress").
async function runCall(
  env: Env,
  { row, config, adapter, sentModel, priced, price }: Prepared,
  request: CallRequest,
  requestKey: string,
  stageId: string | null,
  place: CallPlace,
  timeoutMs: number,
  signal?: AbortSignal,
  onEvent?: (event: CallEvent) => void,
): Promise<CallAnswer> {
  const db = env.DB;
  const callId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const requestSha = await putJson(env.PDFS, await recordedRequest(request));
  await db
    .prepare(
      "INSERT INTO llm_calls (id, stage_id, model_config_id, request_key, request_sha256, item, round, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)",
    )
    .bind(callId, stageId, config.id, requestKey, requestSha, place.item, place.round, startedAt)
    .run();
  onEvent?.({ event: "started", callId, startedAt, timeoutMs });
  const startedMs = Date.parse(startedAt);
  const progress = onEvent ? throttledProgress((p) => onEvent(progressEvent(p, startedMs)), PROGRESS_INTERVAL_MS) : null;

  // The replay model answers from the project's recordings, by the call's place (llm/replay.ts).
  const answering = isReplay(config) ? replayProvider(db, env.PDFS, stageId, place, config.id) : adapter;
  const timeout = withTimeout(signal, timeoutMs);
  let response: LlmResponse;
  try {
    response = await answering.send({
      model: sentModel,
      effort: config.effort ?? undefined,
      ...(row.model_id && modelById(MODEL_LIST, row.model_id)?.thinking === "adaptive" ? { adaptiveThinking: true as const } : {}),
      system: request.system,
      messages: providerMessages(request),
      maxOutputTokens: request.maxOutputTokens,
      jsonSchema: request.jsonSchema,
    }, timeout.signal, progress?.push);
    // The answer's last count reaches the browser before the answer does: an item's next call counts on from it.
    progress?.flush();
  } catch (err) {
    const httpStatus = err instanceof LlmError ? (err.status ?? null) : null;
    // No usable response, so no token counts and no cost. With an HTTP error status, the provider refused the call
    // and didn't bill it, and `auth` without one failed before anything was sent; otherwise it may have been billed
    // (docs/llm.md, "Calling the providers"). Except a 524: Cloudflare's, not the provider's, which cut off a call the
    // provider may have finished and billed; its message says what happened and what may help.
    // Stopped by its timeout: of unknown cost, like a stopped call.
    // Stopped by the browser: "aborted", whatever the adapter made of its cut connection (a network error, say).
    const timedOut = timeout.timedOut();
    const kind = timedOut ? "timeout" : signal?.aborted ? "aborted" : err instanceof LlmError ? err.kind : "unknown";
    const message =
      httpStatus === 524 ? cloudflareTimeoutMessage(PROVIDER_NAMES[config.provider])
      : timedOut ? timedOutMessage(timeoutMs)
      : kind === "aborted" ? ABORTED_CALL
      : err instanceof Error ? err.message : String(err);
    await db
      .prepare("UPDATE llm_calls SET status = 'error', error = ?, error_kind = ?, http_status = ?, finished_at = ? WHERE id = ?")
      .bind(message, kind, httpStatus, new Date().toISOString(), callId)
      .run();
    return { callId, cached: false, status: "error", text: null, json: null, error: message, usage: null, costUsd: null, vatPercent: 0 };
  } finally {
    timeout.clear();
    progress?.stop();
  }

  // The answer is in hand, and was paid for: recording it is a step of its own, so that a failure there (storing the
  // answer, reading the VAT, updating the row) never turns it into a call that failed, of unknown cost. Each part is
  // tried twice, then logged; the answer reaches the browser all the same. An answer that couldn't be stored isn't
  // served from the record later; a row that couldn't be updated stays running, and counts as dead once old enough.
  // An answer that isn't valid JSON comes back with its usage like any other, so its cost is counted.
  const status =
    response.unexpectedModel !== undefined ? "error"
    : response.invalidJson !== undefined ? "unparseable"
    : response.stop === "end" ? "ok"
    : response.stop === "max_tokens" ? "cut_off"
    : response.stop === "refusal" ? "refused"
    : "error";
  // Unpriced: the tokens are known, the cost isn't (a call of unknown cost, docs/llm.md). Priced by the provider: what
  // the answer says it cost, plus the fee on credits; unknown where it doesn't say.
  const fee = feeOf(row);
  const costUsd =
    priced.kind === "unpriced" ? null
    : priced.kind === "provider" ? providerCost(response.reportedCostUsd, fee)
    : price ? costOf(response.usage, price) : 0;
  // The rate in force now, when the cost is recorded (docs/llm.md, "VAT"); 0 where it can't be read.
  const vatPercent = (await bookkeeping(callId, "read the VAT rate", async () => (await readSettings(db)).vatPercent)) ?? 0;
  const responseSha = await bookkeeping(callId, "store the answer", () =>
    putJson(env.PDFS, { text: response.text, json: response.json, stop: response.stop, stopDetail: response.stopDetail, model: response.model, ...(response.servedBy ? { servedBy: response.servedBy } : {}), raw: response.raw }),
  );
  const error =
    status === "ok" ? null
    : response.unexpectedModel !== undefined ? response.unexpectedModel
    : status === "unparseable" ? response.invalidJson!
    : status === "cut_off" ? "The answer was cut off."
    : status === "refused" ? `The model declined${response.stopDetail ? ` (${response.stopDetail})` : ""}.`
    : "The answer ended unexpectedly.";
  await bookkeeping(callId, "record the answer", () =>
    db
      .prepare(
        "UPDATE llm_calls SET status = ?, error = ?, error_kind = ?, response_model = ?, response_sha256 = ?, input_tokens = ?, output_tokens = ?, cached_tokens = ?, cache_write_tokens = ?, cost_usd = ?, vat_percent = ?, price_json = ?, finished_at = ? WHERE id = ?",
      )
      .bind(
        status,
        error,
        response.unexpectedModel !== undefined ? "unexpected_model" : null,
        response.model,
        responseSha,
        response.usage.inputTokens,
        response.usage.outputTokens,
        response.usage.cacheReadTokens,
        response.usage.cacheWriteTokens,
        costUsd,
        vatPercent,
        price ? JSON.stringify({ ...price, asOf: MODEL_LIST.asOf, ...(priced.kind === "priced" && priced.borrowedFrom ? { borrowedFrom: priced.borrowedFrom } : {}) })
        : priced.kind === "provider" || (priced.kind === "free" && row.account) ? JSON.stringify({ reportedUsd: response.reportedCostUsd ?? null, fee, account: row.account })
        : null,
        new Date().toISOString(),
        callId,
      )
      .run(),
  );
  return { callId, cached: false, status, text: response.text, json: response.json ?? null, error, usage: response.usage, costUsd: withVat(costUsd, vatPercent), vatPercent };
}

// A part of recording a call that was answered: tried twice; then logged (the call's id, what failed, why), and null.
async function bookkeeping<T>(callId: string, what: string, part: () => Promise<T>): Promise<T | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await part();
    } catch (err) {
      if (attempt < 2) continue;
      console.error({ call: callId, failed: `couldn't ${what}`, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }
}

export function llmCallRoutes(app: Hono<{ Bindings: Env }>) {
  // An answer that is valid JSON but that the stage can't use (e.g. LilyPond inside it that doesn't parse, or boxes
  // outside the page): it is marked unparseable, so it is never served from the cache again and a retry asks anew
  // (§5.2). Its cost stays in the records: it was paid for.
  app.post("/api/projects/:pid/stages/:sid/llm-calls/:callId/unusable", lock("none"), async (c) => {
    const { pid, sid, callId } = c.req.param();
    const body = await c.req.json().catch(() => null);
    if (typeof body?.reason !== "string" || body.reason.trim() === "") return badRequest(c, "expected a 'reason'");
    const result = await c.env.DB.prepare(
      "UPDATE llm_calls SET status = 'unparseable', error = ? WHERE id = ? AND status = 'ok' AND EXISTS (SELECT 1 FROM pipeline_entries e WHERE e.project_id = ? AND e.stage_id = ?)",
    )
      .bind(body.reason.trim(), callId, pid, sid)
      .run();
    return result.meta.changes === 0 ? refuse(c, 404, `The answer can't be marked unusable: it isn't a usable call of this project. Details: no call ${callId} with status "ok" in the project's pipeline.`) : c.body(null, 204);
  });

  // One LLM request of a running stage. Errors the stage can act on carry a `code`.
  app.post("/api/projects/:pid/stages/:sid/llm", lock("none"), async (c) => {
    const db = c.env.DB;
    const { pid, sid } = c.req.param();
    const body = await c.req.json().catch(() => null);
    const problem = requestProblem(body?.request);
    if (problem) return refuse(c, 400, problemText(problem));
    const request = body.request as CallRequest;
    const place = placeOf(body);
    if (typeof place === "string") return badRequest(c, place);
    // For the request's log line: what the browser calls the call ("System 12"), and how many images it carries.
    const images = request.messages.reduce((n, m) => n + m.content.filter((part) => part.type === "image" && part.image).length, 0);
    logFields(c.req.raw, { ...(typeof body.label === "string" ? { label: body.label.slice(0, 100) } : {}), item: place.item, round: place.round, images });

    const { stage } = stageEntry(c);
    if (stage.status !== "running") return refuse(c, 409, notRunning(stage.status));
    if (!stage.model_config_id) return refuse(c, 409, `The stage has no model config. ${PICK_ONE}`, "no_model_config");
    const row = await db.prepare("SELECT * FROM model_configs WHERE id = ?").bind(stage.model_config_id).first<ModelConfigRow>();
    if (!row) return refuse(c, 409, `The stage's model config doesn't exist. Pick another with "Change config" in the stage's ⋮, then retry.`, "no_model_config");
    // Checked before every request, the cache included: a config deleted while its stage runs is never used again.
    if (row.deleted_at) return refuse(c, 409, deletedWhileRunningMessage(row.name), "deleted_model_config");
    // So is one the app no longer supports (a new list of models), the cache included; its stage wasn't allowed to start.
    const unsupported = unsupportedOf(row);
    if (unsupported) {
      return refuse(c, 409, `The model config "${row.name}" ${unsupported}. Pick another with "Change config" in the stage's ⋮, then retry.`, "unsupported_model_config");
    }
    const config = toModelConfig(row);

    // The request key: the exact request, images by their recipe keys, with the model's provider, model and effort.
    // Not the config's id, region, routing, project or secrets: they don't change the answer (§5.2).
    const requestKey = await keyOf({ ...modelKeyOf(config), request: keyedRequest(request) });

    // The cache first: an answer already paid for is served even when the spending cap is reached. The earliest
    // recorded answer whose content is stored: one whose content is missing (removed by hand, say) is skipped for the
    // next, so that the answer paid for again in its place is served after it.
    const { results: earlier } = await db
      .prepare(
        "SELECT id, response_sha256, input_tokens, output_tokens, cached_tokens, cache_write_tokens FROM llm_calls WHERE request_key = ? AND status = 'ok' AND deleted_at IS NULL AND response_sha256 IS NOT NULL ORDER BY started_at",
      )
      .bind(requestKey)
      .all<{ id: string; response_sha256: string; input_tokens: number; output_tokens: number; cached_tokens: number; cache_write_tokens: number | null }>();
    for (const recorded of earlier) {
      const object = await c.env.PDFS.get(`content/${recorded.response_sha256}`);
      if (!object) continue;
      logFields(c.req.raw, { answer: "cached" });
      const response = (await object.json()) as { text: string; json?: unknown };
      const answer: CallAnswer = {
        callId: recorded.id,
        cached: true,
        status: "ok",
        text: response.text,
        json: response.json ?? null,
        error: null,
        usage: {
          inputTokens: recorded.input_tokens,
          outputTokens: recorded.output_tokens,
          cacheReadTokens: recorded.cached_tokens,
          cacheWriteTokens: recorded.cache_write_tokens ?? 0,
        },
        costUsd: 0,
        vatPercent: 0,
      };
      return c.json<CallAnswer>(answer);
    }

    // Not cached: the browser makes the images and asks again with them.
    if (request.messages.some((m) => m.content.some((c) => c.type === "image" && !c.image))) {
      logFields(c.req.raw, { answer: "images needed" });
      return c.json<ImagesNeeded>({ imagesNeeded: true });
    }

    logFields(c.req.raw, { answer: "sent", provider: config.provider });
    const prepared = await prepareCall(c.env, row);
    if ("refusal" in prepared) {
      return refuse(c, prepared.refusal.status, prepared.refusal.error, prepared.refusal.code);
    }
    // Sent: the answer is streamed as server-sent events, the call's start and its progress while it runs, then the
    // answer (docs/llm.md, "A call's progress"). The request's log line is written at the end.
    const log = deferLog(c.req.raw);
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    // A browser that went away can't be written to: the call is stopped by its signal, and recorded all the same.
    const write = (data: StreamEvent) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});
    const done = (async () => {
      try {
        const answer = await runCall(c.env, prepared, request, requestKey, sid, place, llmTimeoutMs(stage.step), c.req.raw.signal, (event) => void write(event));
        logFields(c.req.raw, { status: answer.status, outputTokens: answer.usage?.outputTokens });
        await write({ event: "answer", answer });
      } catch (err) {
        logFields(c.req.raw, { error: String(err) });
        await write({ event: "error", error: `The server failed while making the call. Details: ${err instanceof Error ? err.message : String(err)}` });
      } finally {
        await writer.close().catch(() => {});
        log(200);
      }
    })();
    try {
      c.executionCtx.waitUntil(done);
    } catch {
      // No execution context (the desktop version, the tests): the stream keeps the work going.
    }
    return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  });
}
