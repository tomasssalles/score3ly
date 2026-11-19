import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage, Project } from "./api.ts";
import { CannotStart, contentsOf, failsTheStage, LEAVING, recordedContent, released, runPlan, type FinalOutput } from "./stageRunner.ts";

// The Worker is a fake that records the requests and answers what runPlan asks.
const realFetch = globalThis.fetch;
let requests: { url: string; body: unknown }[] = [];
const contents = new Map<string, unknown>();

function fakeWorker(start: object = { reused: false, stageId: "s1", runId: "r1", keptOutputs: true }) {
  requests = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith("/start")) return Response.json(start);
    if (url.endsWith("/outputs")) return Response.json({ ids: ["o"] });
    if (url.startsWith("/api/content/")) return Response.json(contents.get(url.slice("/api/content/".length)));
    return Response.json({});
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const project = { id: "p1", name: "Sonata" } as Project;

const stage = (outputs: ApiStage["outputs"]) => ({ id: "s1", step: "layout", outputs }) as ApiStage;

test("a resumed run's note is computed from every output, the earlier run's too", async () => {
  fakeWorker();
  contents.set("sha-p1", { systems: 3 });
  const made = new Map<string, { systems: number }>();
  let seen: FinalOutput[] = [];
  await runPlan(
    { project, stage: stage([{ id: "o1", item: "p1", type: "layout", contentSha256: "sha-p1", recipeKey: null, recipe: null }]), pipeline: { stages: [] } as never, signal: new AbortController().signal, progress: () => {} },
    {
      stepVersion: 1,
      config: null,
      stageKey: "key",
      pageCount: 2,
      inputIds: [],
      items: ["p1", "p2"].map((item) => ({
        item,
        type: "layout",
        make: async () => {
          made.set(item, { systems: 4 });
          return { contentSha256: `sha-${item}` };
        },
      })),
      note: async (outputs) => {
        seen = outputs;
        const layouts = await contentsOf(outputs, "layout", made);
        return `${layouts.reduce((sum, l) => sum + l.systems, 0)} systems`;
      },
    },
  );
  assert.deepEqual(
    seen.map((o) => [o.item, o.contentSha256]),
    [
      ["p1", "sha-p1"],
      ["p2", "sha-p2"],
    ],
  );
  assert.deepEqual([...made.keys()], ["p2"]); // p1 wasn't made again
  const finish = requests.find((r) => r.url.endsWith("/finish"));
  assert.deepEqual(finish?.body, { status: "done", note: "7 systems", runId: "r1" });
});

// A plan of two layout items, "p1" and "p2", that records which it made.
function plan(made: string[], fail?: string) {
  return {
    stepVersion: 1,
    config: null,
    stageKey: "key",
    pageCount: 2,
    inputIds: [],
    items: ["p1", "p2"].map((item) => ({
      item,
      type: "layout",
      make: async () => {
        if (item === fail) throw new Error("The model's answer can't be used.");
        made.push(item);
        return { contentSha256: `sha-${item}` };
      },
    })),
    note: "2 pages",
  };
}
const recordedP1 = [{ id: "o1", item: "p1", type: "layout", contentSha256: "sha-p1", recipeKey: null, recipe: null }];
const runOf = (outputs: ApiStage["outputs"], signal = new AbortController().signal) =>
  ({ project, stage: stage(outputs), pipeline: { stages: [] } as never, signal, progress: () => {} });
const sent = (action: string) => requests.filter((r) => r.url.endsWith(`/${action}`)).map((r) => r.body);

test("a run sends its run id with its outputs, heartbeats and end", async () => {
  fakeWorker();
  await runPlan(runOf([]), plan([]));
  assert.deepEqual(sent("outputs").map((b) => (b as { runId: string }).runId), ["r1", "r1"]);
  assert.deepEqual(sent("finish"), [{ status: "done", note: "2 pages", runId: "r1" }]);
});

test("a reused stage runs nothing", async () => {
  fakeWorker({ reused: true, stageId: "s0" });
  const made: string[] = [];
  await runPlan(runOf([]), plan(made));
  assert.deepEqual(made, []);
  assert.deepEqual(requests.map((r) => r.url.split("/").pop()), ["start"]);
});

test("a resumed run makes only what the earlier run didn't record, unless the Worker dropped it (another key)", async () => {
  fakeWorker();
  let made: string[] = [];
  await runPlan(runOf(recordedP1), plan(made));
  assert.deepEqual(made, ["p2"]);
  fakeWorker({ reused: false, stageId: "s1", runId: "r2", keptOutputs: false });
  made = [];
  await runPlan(runOf(recordedP1), plan(made));
  assert.deepEqual(made, ["p1", "p2"]);
});

test("an error ends the run failed, with the error", async () => {
  fakeWorker();
  const made: string[] = [];
  await runPlan(runOf([]), plan(made, "p2"));
  assert.deepEqual(made, ["p1"]);
  assert.deepEqual(sent("finish"), [{ status: "failed", error: "The model's answer can't be used.", runId: "r1" }]);
});

// A plan whose first item waits until the test aborts the run.
function abortedPlan(abort: AbortController, reason?: string) {
  const p = plan([]);
  p.items[0].make = async () => {
    abort.abort(reason);
    await new Promise((resolve) => setTimeout(resolve, 10)); // the item ends after the abort (images can't be cancelled)
    return { contentSha256: "sha-p1" };
  };
  return p;
}

test("leaving the project mid-run releases the stage at once, and records nothing more", async () => {
  fakeWorker();
  const abort = new AbortController();
  await runPlan(runOf([], abort.signal), abortedPlan(abort, LEAVING));
  assert.deepEqual(sent("release"), [{ runId: "r1" }]);
  await released(); // answered: the home can load the projects
  assert.deepEqual(sent("outputs"), []);
  assert.deepEqual(sent("finish"), []);
});

test("Stop aborts the run without releasing it (the Worker's stop ends it), and records nothing more", async () => {
  fakeWorker();
  const abort = new AbortController();
  await runPlan(runOf([], abort.signal), abortedPlan(abort));
  assert.deepEqual(requests.map((r) => r.url.split("/").pop()), ["start"]);
});

test("an error before the start fails the stage, unless the user has to do something first or the Worker refused the start", async () => {
  assert.equal(failsTheStage(new Error("Loading the layouts failed: network error")), true);
  assert.equal(failsTheStage(new CannotStart("the layout hasn't been found yet.")), false);
  fakeWorker();
  globalThis.fetch = async () => Response.json({ error: "The stage can't start now." }, { status: 409 });
  const refused = await runPlan(runOf([]), plan([])).catch((err: unknown) => err);
  assert.ok(refused instanceof Error);
  assert.equal(failsTheStage(refused), false);
});

test("recordedContent loads a stage's stored outputs of one type, by item", async () => {
  fakeWorker();
  contents.set("sha-a", { system: 1 });
  contents.set("sha-b", { system: 2 });
  const recorded = await recordedContent<{ system: number }>(
    stage([
      { id: "o1", item: "p1/s1", type: "review", contentSha256: "sha-a", recipeKey: null, recipe: null },
      { id: "o2", item: "p1/s2", type: "review", contentSha256: "sha-b", recipeKey: null, recipe: null },
      { id: "o3", item: "p1/s3", type: "review", contentSha256: null, recipeKey: "k", recipe: {} },
      { id: "o4", item: "", type: "score_checks", contentSha256: "sha-c", recipeKey: null, recipe: null },
    ]),
    "review",
  );
  assert.deepEqual([...recorded], [["p1/s1", { system: 1 }], ["p1/s2", { system: 2 }]]);
  assert.deepEqual(requests.map((r) => r.url), ["/api/content/sha-a", "/api/content/sha-b"]);
});
