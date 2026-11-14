import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, callLlm, createProject, listProjects, lookUpPdf, markOpened, renameProject, type Project } from "./api.ts";

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
