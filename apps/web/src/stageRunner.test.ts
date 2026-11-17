import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import type { ApiStage, Project } from "./api.ts";
import { contentsOf, runPlan, type FinalOutput } from "./stageRunner.ts";

// The Worker is a fake that records the requests and answers what runPlan asks.
const realFetch = globalThis.fetch;
let requests: { url: string; body: unknown }[] = [];
const contents = new Map<string, unknown>();

function fakeWorker() {
  requests = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.endsWith("/start")) return Response.json({ reused: false, stageId: "s1" });
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
  assert.deepEqual(finish?.body, { status: "done", note: "7 systems" });
});
