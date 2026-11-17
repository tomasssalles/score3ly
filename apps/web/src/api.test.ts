import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, callLlm, failure, createModelConfig, createProject, importRows, listProjects, lookUpPdf, markOpened, renameProject, STALE_EVENT, type Project, type ProjectExport } from "./api.ts";

// The tests replace the browser's fetch with a fake that records each request and answers with a fixed response.
const realFetch = globalThis.fetch;
let requests: { url: string; init: RequestInit }[] = [];

function answerWith(status: number, body?: unknown) {
  requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const SHA256 = "ab".repeat(32);

const project: Project = {
  id: "p1",
  name: "Sonata",
  pdfSha256: SHA256,
  pdfFilename: "sonata.pdf",
  createdAt: "2026-10-07T10:00:00.000Z",
  lastModifiedAt: "2026-10-07T10:00:00.000Z",
  lastOpenedAt: "2026-10-07T10:00:00.000Z",
  runMode: "auto",
};

test("listProjects gets the projects", async () => {
  answerWith(200, [project]);

  assert.deepEqual(await listProjects(), [project]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/projects");
  assert.equal(requests[0].init.method ?? "GET", "GET");
});

test("lookUpPdf asks about the hash and passes the file name along, encoded", async () => {
  const lookup = { projects: [project], newProjectName: "a b&c (1)" };
  answerWith(200, lookup);

  assert.deepEqual(await lookUpPdf(SHA256, "a b&c.pdf"), lookup);

  const url = new URL(requests[0].url, "http://app");
  assert.equal(url.pathname, `/api/pdfs/${SHA256}`);
  assert.equal(url.searchParams.get("filename"), "a b&c.pdf");
  assert.deepEqual([...url.searchParams.keys()], ["filename"]);
});

test("createProject uploads a PDF that isn't stored yet", async () => {
  answerWith(201, project);
  const pdf = new File(["pdf bytes"], "sonata.pdf");

  assert.deepEqual(await createProject(pdf, SHA256, false), project);

  assert.equal(requests[0].url, "/api/projects");
  assert.equal(requests[0].init.method, "POST");
  const form = requests[0].init.body as FormData;
  assert.deepEqual([...form.keys()].sort(), ["pdf", "sha256"]);
  assert.equal(form.get("sha256"), SHA256);
  const sent = form.get("pdf") as File;
  assert.equal(sent.name, "sonata.pdf");
  assert.equal(await sent.text(), "pdf bytes");
});

test("createProject sends only the file name of a PDF that is already stored", async () => {
  answerWith(201, project);
  const pdf = new File(["pdf bytes"], "sonata.pdf");

  await createProject(pdf, SHA256, true);

  const form = requests[0].init.body as FormData;
  assert.deepEqual([...form.keys()].sort(), ["filename", "sha256"]);
  assert.equal(form.get("filename"), "sonata.pdf");
  assert.equal(form.get("sha256"), SHA256);
});

test("markOpened posts to the project and expects no content back", async () => {
  answerWith(204);

  assert.equal(await markOpened(project), undefined);

  assert.equal(requests[0].url, "/api/projects/p1/opened");
  assert.equal(requests[0].init.method, "POST");
});

test("renameProject sends the new name as JSON and returns the renamed project", async () => {
  const renamed = { ...project, name: "Sonata in A" };
  answerWith(200, renamed);

  assert.deepEqual(await renameProject(project, "Sonata in A"), renamed);

  assert.equal(requests[0].url, "/api/projects/p1");
  assert.equal(requests[0].init.method, "PATCH");
  assert.equal(new Headers(requests[0].init.headers).get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(requests[0].init.body as string), { name: "Sonata in A" });
});

test("a refused request fails with an ApiError that carries the HTTP status", async () => {
  // 409 is how the Worker refuses a name that is taken; the rename dialog looks for it.
  answerWith(409, { error: "taken" });
  await assert.rejects(renameProject(project, "Taken"), (err) => err instanceof ApiError && err.status === 409);

  const calls: [string, () => Promise<unknown>][] = [
    ["listProjects", () => listProjects()],
    ["lookUpPdf", () => lookUpPdf(SHA256, "sonata.pdf")],
    ["createProject", () => createProject(new File([""], "sonata.pdf"), SHA256, false)],
    ["markOpened", () => markOpened(project)],
    ["renameProject", () => renameProject(project, "New")],
  ];
  for (const [name, call] of calls) {
    answerWith(500, { error: "broken" });
    await assert.rejects(call(), (err) => err instanceof ApiError && err.status === 500, name);
  }
});

// The error contract (docs/style.md, "Error texts"): every refusal is one ApiError whose message is the Worker's text,
// with its code, whichever request it was (the code review's A1, A6).
test("a refusal's ApiError carries the Worker's text and code, for every kind of request", async () => {
  const refusal = { error: "A project with that name already exists. Names must be unique (case-insensitive).", code: "name_taken" };
  const calls: [string, () => Promise<unknown>][] = [
    ["renameProject", () => renameProject(project, "Taken")],
    ["callLlm", () => callLlm(project, "s1", { messages: [] }, { item: "p1", round: 1 })],
    ["createModelConfig", () => createModelConfig({} as never)],
    ["importRows", () => importRows({} as ProjectExport)],
  ];
  for (const [name, call] of calls) {
    answerWith(409, refusal);
    await assert.rejects(call(), (err) => err instanceof ApiError && err.message === refusal.error && err.code === "name_taken" && err.status === 409, name);
  }
});

test("an answer that isn't the Worker's JSON still fails with a sentence, not a bare status", async () => {
  requests = [];
  globalThis.fetch = async () => new Response("<html>Bad gateway</html>", { status: 502 });
  await assert.rejects(listProjects(), (err) => err instanceof ApiError && err.code === null && /^The server couldn't answer this request\. Details: HTTP 502/.test(err.message));
});

test("a stale change fires the event for the \"Changed elsewhere\" dialog, whatever the request", async () => {
  const fired: string[] = [];
  const g = globalThis as unknown as { dispatchEvent?: (event: Event) => boolean };
  g.dispatchEvent = (event) => (fired.push(event.type), true); // the window's, in the browser
  try {
    answerWith(409, { error: "changed", code: "stale_version" });
    await assert.rejects(renameProject(project, "New"), (err) => err instanceof ApiError && err.stale);
    answerWith(409, { error: "taken", code: "name_taken" });
    await assert.rejects(renameProject(project, "New"), (err) => err instanceof ApiError && !err.stale);
    assert.deepEqual(fired, [STALE_EVENT]);
  } finally {
    delete g.dispatchEvent;
  }
});

// A stale change is said once, by the "Changed elsewhere" dialog: the screens' banners show nothing for it (the code
// review's A2); any other error after what was being done, in the Worker's words, never "Error: HTTP 409".
test("what a screen shows for an error: the Worker's text after what was being done, nothing for a stale change", () => {
  assert.equal(failure("Dropping the stage failed", new ApiError(409, { error: "changed", code: "stale_version" })), null);
  assert.equal(
    failure("Dropping the stage failed", new ApiError(409, { error: "A stage of this project is running.", code: "running" })),
    "Dropping the stage failed: A stage of this project is running.",
  );
  assert.equal(failure(null, new Error("The page can't be drawn.")), "The page can't be drawn.");
  assert.equal(failure("Saving failed", "lost"), "Saving failed: lost");
});

test("a sent call's streamed answer: its start and progress go to the listener, its answer is returned", async () => {
  const events = [
    { event: "started", callId: "c1", startedAt: "2026-11-14T10:00:00.000Z", timeoutMs: 3_600_000 },
    { event: "progress", elapsedMs: 1000, outputTokens: null, textChars: 0, thinkingChars: 200 },
    { event: "answer", answer: { callId: "c1", cached: false, status: "ok", text: "{}", json: {}, error: null, usage: null, costUsd: 0 } },
  ];
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
  };
  const seen: unknown[] = [];
  const answer = await callLlm(project, "s1", { messages: [] }, { item: "p1", round: 2 }, "Page 1", undefined, (e) => seen.push(e));
  // The call's place goes with the request, beside it.
  assert.deepEqual([body.item, body.round, body.label], ["p1", 2, "Page 1"]);
  assert.deepEqual(seen, events.slice(0, 2));
  assert.equal("callId" in answer && answer.callId, "c1");
});

test("a streamed answer that ends without one fails with the server's error, or says the connection ended", async () => {
  globalThis.fetch = async () =>
    new Response(`data: ${JSON.stringify({ event: "error", error: "D1 is down" })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  await assert.rejects(callLlm(project, "s1", { messages: [] }, { item: "", round: 1 }), /D1 is down/);
  globalThis.fetch = async () => new Response(`data: ${JSON.stringify({ event: "started", callId: "c", startedAt: "", timeoutMs: 1 })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  await assert.rejects(callLlm(project, "s1", { messages: [] }, { item: "", round: 1 }), /ended before the answer came/);
});
