// Snapshots of everything the music stages' runners send, taken before the code review's batch 28 moved how they find
// and load their inputs (stageInputs.ts, musicStage.ts; review/plan.md, "What guards requests"). `extract`, `review`,
// both `apply_review`s and `build_mei` run in Node on the fake fixture's pipeline (fixtures/replay/fake.s3l: a human
// review, issues of the model, of code and of the review), against a fake Worker that answers each call with the
// fixture's recorded answer at the same place and numbers issues as the Worker does. Per stage, a hash of what it sent:
// its start (stage key, input ids, page count), every LLM request (as sent first, without images: texts, schemas,
// images by recipe key), the issue numbers it asked for, the outputs it recorded (content and inputs) and its finish.
// The same inputs must give the same bytes, or every call is paid again. Only a change that means to change requests
// (the paid release) may update them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { canonicalJson } from "@score3ly/core";
import type { ApiStage, ModelConfig } from "./api.ts";
import { fakeFixture } from "./testing/fixture.ts";

register(new URL("./testing/tsResolve.ts", import.meta.url));
(globalThis as Record<string, unknown>).__APP_VERSION__ = "0.0.0-test";

const fixture = fakeFixture();
const stages = fixture.pipeline.stages;

const MODEL_CONFIG: ModelConfig = {
  id: "fake-model",
  name: "Fake model",
  provider: "fake",
  modelId: "fake",
  modelString: null,
  model: "fake",
  family: "fake",
  modelName: "Fake",
  unsupported: null,
  effort: null,
  region: "",
  routing: null,
  project: null,
  account: null,
  secrets: {},
  pricing: "free",
  price: { kind: "free" },
  freeTier: true,
  createdAt: "2026-11-15T08:36:05.519Z",
  deletedAt: null,
} as unknown as ModelConfig;

// The issue numbers a stage's outputs hold: every object with a numeric `id` and a `question`.
function issueIds(json: unknown, into = new Set<number>()): Set<number> {
  if (Array.isArray(json)) for (const x of json) issueIds(x, into);
  else if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (typeof o.id === "number" && typeof o.question === "string") into.add(o.id);
    for (const v of Object.values(o)) issueIds(v, into);
  }
  return into;
}
const jsonOf = (sha256: string) => JSON.parse(new TextDecoder().decode(fixture.content.get(sha256)!));
const jsonOrNull = (sha256: string) => {
  try {
    return jsonOf(sha256);
  } catch {
    return null; // the MEI
  }
};
const idsOfStage = (s: ApiStage) => issueIds(s.outputs.filter((o) => o.contentSha256 && fixture.content.has(o.contentSha256)).map((o) => jsonOrNull(o.contentSha256!)));

type Sent = { method: string; url: string; body: unknown };

// Runs the stage at `index` of the fixture's pipeline, as planned (no outputs), with the stages before it as recorded.
async function runStage(index: number, run: (r: never) => Promise<void>): Promise<{ sent: Sent[]; error: string | null }> {
  const stage: ApiStage = { ...stages[index], status: "planned", outputs: [] };
  const pipeline = { stages: stages.map((s, i) => (i === index ? stage : s)), dropped: [] };
  // The counter where the recorded stage started (as the replay sets it): its smallest number no earlier stage has.
  const before = new Set(stages.slice(0, index).flatMap((s) => [...idsOfStage(s)]));
  const own = [...idsOfStage(stages[index])].filter((id) => !before.has(id));
  let next = own.length > 0 ? Math.min(...own) : 1000;
  const stored = new Map(fixture.content);
  const sent: Sent[] = [];
  let error: string | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
    const content = /^\/api\/content\/([0-9a-f]{64})$/.exec(url);
    if (content && method === "GET") {
      const bytes = stored.get(content[1]);
      return bytes ? new Response(bytes as BodyInit, { status: 200 }) : new Response(JSON.stringify({ error: "missing" }), { status: 404 });
    }
    if (content && method === "PUT") {
      stored.set(content[1], new Uint8Array(await new Response(init!.body).arrayBuffer()));
      return new Response(null, { status: 204 });
    }
    if (url === `/api/model-configs/${MODEL_CONFIG.id}`) return json(MODEL_CONFIG);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    const action = /\/stages\/[^/]+\/(.+)$/.exec(url)?.[1] ?? url;
    if (action === "heartbeat") return json({});
    const { timing: _timing, ...rest } = body ?? {};
    sent.push({ method, url: action, body: action === "outputs" ? { ...rest, outputs: body.outputs.map(({ timing: _t, ...o }: Record<string, unknown>) => o) } : body });
    if (action === "start") return json({ reused: false, stageId: stage.id, runId: "run-1", keptOutputs: false });
    if (action === "outputs") return json({ ids: body.outputs.map((_: unknown, i: number) => `new-${i}`) });
    if (action === "finish") {
      if (body.status === "failed") error = body.error;
      return json({});
    }
    if (action === "llm") {
      const call = fixture.calls.find((c) => c.stageId === stage.id && c.item === body.item && c.round === body.round && c.status === "ok");
      if (!call) throw new Error(`no recorded answer for ${body.item}, round ${body.round}`);
      const response = jsonOf(call.responseSha256!);
      return json({ callId: `call-${body.item}`, cached: true, status: "ok", text: null, json: response.json, error: null, usage: null, costUsd: 0, vatPercent: 0 });
    }
    if (url.endsWith("/issue-numbers")) {
      const first = Math.max(next, body.above + 1);
      next = first + body.count;
      return json({ first });
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  }) as typeof fetch;
  try {
    await run({ project: { id: "project-1", name: "Fake model" }, stage, pipeline, signal: new AbortController().signal, progress: () => {} } as never);
  } finally {
    globalThis.fetch = realFetch;
  }
  return { sent, error };
}

const outputById = new Map(stages.flatMap((s) => s.outputs).map((o) => [o.id, o]));
const contentOf = (ids: string[]) =>
  [...new Set(ids)].map((id) => outputById.get(id)!).map((o) => `${o.type} ${o.item} ${o.contentSha256 ?? o.recipeKey}`).sort();

const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16);

const at = (step: string, turn = 1) => stages.map((s, i) => [s, i] as const).filter(([s]) => s.step === step)[turn - 1][1];

// Per stage: the hash of everything sent, and how many requests of each kind. Changed once on purpose (the code
// review's batch 29): the starts' stage keys (`LENS_VERSION` 5) and step versions (`review` and `apply_review` 3);
// everything else the same, checked with those two fields left out. Changed once more by the paid release (batch
// 33): the straightened pages' recipes, and the music stages' images' recipes, name no deskew version (B8, dec. 6), so
// the images' keys in the requests and the stage keys; checked by putting the version back, which gives the old hashes.
// Batch 34 (the paid release, prompts): each request's diff read; review and both Apply reviews read a reading
// issue's `lilypond` as [] (C31); the system prompts' new sentences and the stage keys of the new prompt versions.
const EXPECTED: Record<string, { hash: string; counts: Record<string, number> }> = {
  extract: { hash: "fe8fa6ee00b9ebd4", counts: { start: 1, llm: 6, "issue-numbers": 6, outputs: 7, finish: 1 } },
  review: { hash: "d05d0f087f489f53", counts: { start: 1, llm: 6, "issue-numbers": 1, outputs: 6, finish: 1 } },
  "apply_review 1": { hash: "6e0c392169f80097", counts: { start: 1, llm: 2, outputs: 9, finish: 1 } },
  "apply_review 2": { hash: "bb7238b7109b204e", counts: { start: 1, outputs: 7, finish: 1 } },
  build_mei: { hash: "f9c01eee702a35a4", counts: { start: 1, outputs: 1, finish: 1 } },
};

const RUNS: [string, number, () => Promise<(r: never) => Promise<void>>][] = [
  ["extract", at("extract"), async () => (await import("./runExtract.ts")).runExtract],
  ["review", at("review"), async () => (await import("./runReview.ts")).runReview],
  ["apply_review 1", at("apply_review", 1), async () => (await import("./runApplyReview.ts")).runApplyReview],
  ["apply_review 2", at("apply_review", 2), async () => (await import("./runApplyReview.ts")).runApplyReview],
  ["build_mei", at("build_mei"), async () => (await import("./runBuildMei.ts")).runBuildMei],
];

for (const [name, index, load] of RUNS) {
  test(`what ${name} sends on the fake fixture is unchanged`, async () => {
    const { sent, error } = await runStage(index, await load());
    assert.equal(error, null);
    // What it starts with reads what the recorded stage read (the same content, as the Worker compares them).
    const start = sent.find((s) => s.url === "start")!.body as { inputIds: string[] };
    assert.deepEqual(contentOf(start.inputIds), contentOf(fixture.stageInputs.get(stages[index].id) ?? []));
    // And it stores what the recorded stage stored (but the MEI, which names the app's version).
    if (name !== "build_mei") {
      const made = sent.filter((s) => s.url === "outputs").flatMap((s) => (s.body as { outputs: { item: string; type: string; contentSha256?: string }[] }).outputs);
      assert.deepEqual(
        made.map((o) => `${o.type} ${o.item} ${o.contentSha256}`).sort(),
        stages[index].outputs.map((o) => `${o.type} ${o.item} ${o.contentSha256}`).sort(),
      );
    }
    const counts: Record<string, number> = {};
    for (const s of sent) {
      const kind = s.url.replace(/^\/api\/projects\/[^/]+\//, "");
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    const got = { hash: hash(sent), counts };
    assert.deepEqual(got, EXPECTED[name]);
  });
}
