import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";
import { defaultName, firstFreeName } from "./names.ts";

// The tests run the API against Wrangler's local R2 and D1, kept in memory.
const workerDir = join(import.meta.dirname, "..");
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
// The projects as migration 0002 converted them from the old schema.
let migratedRows: Record<string, unknown>[];
// The pipelines migrations 0004 and 0006 gave them.
let migratedPipelines: Record<string, unknown>[];
let migratedPlanned: Record<string, unknown>[];

before(async () => {
  platform = await getPlatformProxy<Env>({ configPath: join(workerDir, "wrangler.jsonc"), persist: false });
  env = platform.env;
  const migrationsDir = join(workerDir, "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.startsWith("0002_")) {
      // Projects created before names existed.
      await env.DB.exec(
        withoutComments(`
          INSERT INTO projects VALUES ('p1', 'aa', 'Sonata.pdf', '2026-10-01T00:00:00.000Z');
          INSERT INTO projects VALUES ('p2', 'aa', 'sonata.PDF', '2026-10-02T00:00:00.000Z');
          INSERT INTO projects VALUES ('p3', 'bb', ' Etude ', '2026-10-03T00:00:00.000Z');
          INSERT INTO projects VALUES ('p4', 'cc', '.pdf', '2026-10-04T00:00:00.000Z');
        `),
      );
    }
    await env.DB.exec(withoutComments(readFileSync(join(migrationsDir, file), "utf8")));
  }
  migratedRows = (await env.DB.prepare("SELECT * FROM projects ORDER BY id").all()).results;
  migratedPipelines = (
    await env.DB.prepare(
      "SELECT e.project_id, e.position, s.id AS stage_id, s.step, s.status, o.id AS output_id, o.item, o.type, o.content_sha256 FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id JOIN outputs o ON o.stage_id = s.id ORDER BY e.project_id",
    ).all()
  ).results;
  migratedPlanned = (
    await env.DB.prepare(
      "SELECT e.project_id, e.position, s.step, s.status, s.config_json FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.position >= 2 ORDER BY e.project_id, e.position",
    ).all()
  ).results;
});

beforeEach(async () => {
  await env.DB.exec(
    "DELETE FROM output_inputs; DELETE FROM stage_inputs; DELETE FROM outputs; DELETE FROM pipeline_entries; DELETE FROM stages; DELETE FROM projects;",
  );
});

after(async () => {
  await platform.dispose();
});

// D1's exec() wants each statement on one line, without comments.
function withoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/; /g, ";\n");
}

// Stands in for a PDF: the API never looks inside the file.
function pdfBytes(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ProjectJson = Record<string, string>;

async function createdProject(filename: string, content = filename): Promise<ProjectJson> {
  const pdf = pdfBytes(content);
  const response = await postProject({ pdf, filename, sha256: await sha256Hex(pdf) });
  assert.equal(response.status, 201);
  return (await response.json()) as ProjectJson;
}

function rename(id: string, name: unknown) {
  return app.request(
    `/api/projects/${id}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
    env,
  );
}

function postProject(fields: {
  pdf?: Uint8Array<ArrayBuffer>;
  filename?: string;
  sha256?: string;
  filenameOnly?: boolean;
}) {
  const form = new FormData();
  if (fields.filenameOnly) {
    form.append("filename", fields.filename ?? "score.pdf");
  } else if (fields.pdf) {
    form.append("pdf", new File([fields.pdf], fields.filename ?? "score.pdf"));
  }
  if (fields.sha256 !== undefined) {
    form.append("sha256", fields.sha256);
  }
  return app.request("/api/projects", { method: "POST", body: form }, env);
}

async function projectRows() {
  const { results } = await env.DB.prepare("SELECT * FROM projects ORDER BY pdf_filename").all();
  return results;
}

test("creating a project stores the PDF in R2 and a row in D1", async () => {
  const pdf = pdfBytes("first pdf");
  const sha256 = await sha256Hex(pdf);
  const started = Date.now();

  const response = await postProject({ pdf, filename: "sonata.pdf", sha256 });

  assert.equal(response.status, 201);
  const project = (await response.json()) as Record<string, string>;
  assert.equal(project.pdfSha256, sha256);
  assert.equal(project.pdfFilename, "sonata.pdf");
  assert.equal(project.name, "sonata");
  assert.ok(project.id.length > 0);
  const created = Date.parse(project.createdAt);
  assert.ok(created >= started && created <= Date.now());
  assert.equal(project.lastModifiedAt, project.createdAt);
  assert.equal(project.lastOpenedAt, project.createdAt);

  assert.deepEqual(await projectRows(), [
    {
      id: project.id,
      name: "sonata",
      pdf_sha256: sha256,
      pdf_filename: "sonata.pdf",
      created_at: project.createdAt,
      last_modified_at: project.createdAt,
      last_opened_at: project.createdAt,
      run_mode: "auto",
      version: 0,
      next_issue_number: 1,
      deleted_at: null,
    },
  ]);

  // Its first stage, Ingest, is done, with the PDF as its output; the rest of the recipe is planned.
  const pipeline = (await (await app.request(`/api/projects/${project.id}/pipeline`, {}, env)).json()) as {
    stages: Record<string, unknown>[];
  };
  assert.deepEqual(
    pipeline.stages.map((s) => [s.step, s.status, s.config]),
    [
      ["ingest", "done", {}],
      ["rasterize", "planned", null],
      ["skew_analysis", "planned", null],
      ["layout", "planned", null],
      ["analyze", "planned", null],
      ["extract", "planned", null],
      ["engrave", "planned", null],
    ],
  );
  const [ingest] = pipeline.stages;
  assert.equal(ingest.step, "ingest");
  assert.equal(ingest.stepVersion, 1);
  assert.equal(ingest.status, "done");
  assert.deepEqual(ingest.config, {});
  assert.equal(ingest.startedAt, project.createdAt);
  assert.equal(ingest.finishedAt, project.createdAt);
  assert.deepEqual(
    (ingest.outputs as Record<string, unknown>[]).map((o) => [o.item, o.type, o.contentSha256]),
    [["", "pdf", sha256]],
  );

  const stored = await env.PDFS.get(`pdfs/${sha256}.pdf`);
  assert.ok(stored);
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), pdf);
});

test("a PDF that is already known gets another project", async () => {
  const pdf = pdfBytes("second pdf");
  const sha256 = await sha256Hex(pdf);

  const first = (await (await postProject({ pdf, filename: "a.pdf", sha256 })).json()) as Record<string, string>;
  const second = (await (await postProject({ pdf, filename: "b.pdf", sha256 })).json()) as Record<string, string>;

  assert.notEqual(first.id, second.id);
  const rows = await projectRows();
  assert.deepEqual(
    rows.map((row) => [row.id, row.name, row.pdf_sha256, row.pdf_filename]),
    [
      [first.id, "a", sha256, "a.pdf"],
      [second.id, "b", sha256, "b.pdf"],
    ],
  );
});

test("a hash that doesn't match the PDF creates nothing, and says so", async () => {
  const pdf = pdfBytes("third pdf");
  const wrongSha256 = await sha256Hex(pdfBytes("something else"));

  const response = await postProject({ pdf, sha256: wrongSha256 });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "the PDF doesn't match its SHA-256" });
  assert.deepEqual(await projectRows(), []);
  assert.equal(await env.PDFS.get(`pdfs/${wrongSha256}.pdf`), null);
});

test("a request without a PDF or with a malformed hash is rejected", async () => {
  const pdf = pdfBytes("fourth pdf");
  const sha256 = await sha256Hex(pdf);

  assert.equal((await postProject({ sha256 })).status, 400);
  assert.equal((await postProject({ pdf })).status, 400);
  assert.equal((await postProject({ pdf, sha256: sha256.toUpperCase() })).status, 400);
  assert.equal((await postProject({ pdf, sha256: "../" + sha256 })).status, 400);
  assert.deepEqual(await projectRows(), []);
});

test("migration 0002 names existing projects after their file and numbers repeats", () => {
  assert.deepEqual(
    migratedRows.map((row) => [row.id, row.name, row.created_at, row.last_modified_at, row.last_opened_at]),
    [
      ["p1", "Sonata", "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
      ["p2", "sonata (1)", "2026-10-02T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "2026-10-02T00:00:00.000Z"],
      ["p3", "Etude", "2026-10-03T00:00:00.000Z", "2026-10-03T00:00:00.000Z", "2026-10-03T00:00:00.000Z"],
      ["p4", "Untitled", "2026-10-04T00:00:00.000Z", "2026-10-04T00:00:00.000Z", "2026-10-04T00:00:00.000Z"],
    ],
  );
});

test("migration 0004 gives existing projects their Ingest stage, with the PDF as its output", () => {
  assert.deepEqual(
    migratedPipelines.map((row) => [row.project_id, row.position, row.step, row.status, row.item, row.type, row.content_sha256]),
    [
      ["p1", 1, "ingest", "done", "", "pdf", "aa"],
      ["p2", 1, "ingest", "done", "", "pdf", "aa"],
      ["p3", 1, "ingest", "done", "", "pdf", "bb"],
      ["p4", 1, "ingest", "done", "", "pdf", "cc"],
    ],
  );
  assert.equal(new Set(migratedPipelines.map((row) => row.stage_id)).size, 4);
});

test("migrations 0006, 0007, 0010, 0011, 0013 and 0015 give existing projects the recipe's planned stages", () => {
  assert.deepEqual(
    migratedPlanned.map((row) => [row.project_id, row.position, row.step, row.status, row.config_json]),
    ["p1", "p2", "p3", "p4"].flatMap((id) => [
      [id, 2, "rasterize", "planned", null],
      [id, 3, "skew_analysis", "planned", null],
      [id, 4, "layout", "planned", null],
      [id, 5, "analyze", "planned", null],
      [id, 6, "extract", "planned", null],
      [id, 7, "engrave", "planned", null],
    ]),
  );
});

test("content is stored under its hash, and served as it was sent", async () => {
  const bytes = pdfBytes('{"lines":[]}');
  const sha256 = await sha256Hex(bytes);
  const put = (hash: string) =>
    app.request(`/api/content/${hash}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: bytes }, env);
  assert.equal((await put(sha256)).status, 204);
  assert.equal((await put(sha256)).status, 204); // again: harmless
  const response = await app.request(`/api/content/${sha256}`, {}, env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(await response.text(), '{"lines":[]}');
  assert.equal((await put("d".repeat(64))).status, 400);
  assert.equal((await app.request(`/api/content/${"e".repeat(64)}`, {}, env)).status, 404);
  assert.equal((await app.request("/api/content/nothex", {}, env)).status, 400);
});

test("deleted projects are left out everywhere, and their names are free", async () => {
  const live = await createdProject("sonata.pdf");
  await env.DB.prepare(
    "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at, deleted_at) VALUES ('gone', 'Etude', ?, 'etude.pdf', 't', 't', 'z', 't')",
  )
    .bind(live.pdfSha256)
    .run();

  const list = (await (await app.request("/api/projects", {}, env)).json()) as ProjectJson[];
  assert.deepEqual(
    list.map((p) => p.id),
    [live.id],
  );
  const lookup = (await (
    await app.request(`/api/pdfs/${live.pdfSha256}?filename=Etude.pdf`, {}, env)
  ).json()) as { projects: ProjectJson[]; newProjectName: string };
  assert.deepEqual(
    lookup.projects.map((p) => p.id),
    [live.id],
  );
  assert.equal(lookup.newProjectName, "Etude");
  assert.equal((await rename(live.id, "etude")).status, 200);
  assert.equal((await rename("gone", "Fugue")).status, 404);
  assert.equal((await app.request("/api/projects/gone/opened", { method: "POST" }, env)).status, 404);
  assert.equal((await app.request("/api/projects/gone/pipeline", {}, env)).status, 404);
});

test("the run mode can be changed, and nothing else in the same request is required", async () => {
  const project = await createdProject("sonata.pdf");
  assert.equal(project.runMode, "auto");
  const patch = (body: unknown) =>
    app.request(
      `/api/projects/${project.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      env,
    );

  const response = await patch({ runMode: "manual" });

  assert.equal(response.status, 200);
  const changed = (await response.json()) as ProjectJson;
  assert.equal(changed.runMode, "manual");
  assert.equal(changed.name, "sonata");
  assert.equal((await patch({ runMode: "sometimes" })).status, 400);
  assert.equal((await patch({})).status, 400);
});

test("a new project starts in the run mode the settings say", async () => {
  const setMode = (value: unknown) =>
    app.request(
      "/api/settings/newProjectRunMode",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) },
      env,
    );
  assert.equal((await setMode("sometimes")).status, 400);
  assert.equal((await setMode("manual")).status, 200);
  assert.equal((await createdProject("manual.pdf")).runMode, "manual");
  await setMode("auto");
  assert.equal((await createdProject("auto.pdf")).runMode, "auto");
});

test("names only have to be unique among projects that aren't deleted", async () => {
  const insert = (id: string, name: string, deletedAt: string | null) =>
    env.DB.prepare(
      "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at, deleted_at) VALUES (?, ?, 'aa', 'a.pdf', 't', 't', 't', ?)",
    )
      .bind(id, name, deletedAt)
      .run();
  await insert("d1", "Sonata", "2026-10-12T00:00:00.000Z");
  await insert("d2", "sonata", "2026-10-12T00:00:00.000Z");
  await insert("live", "Sonata", null);
  await assert.rejects(insert("clash", "SONATA", null), /UNIQUE constraint failed: projects\.name/);
});

test("defaultName drops the .pdf suffix and surrounding spaces", () => {
  assert.equal(defaultName("Sonata.pdf"), "Sonata");
  assert.equal(defaultName(" Sonata .PDF "), "Sonata");
  assert.equal(defaultName("score.pdf.pdf"), "score.pdf");
  assert.equal(defaultName("notes.txt"), "notes.txt");
  assert.equal(defaultName(".pdf"), "Untitled");
  assert.equal(defaultName("x".repeat(300) + ".pdf"), "x".repeat(200));
});

test("firstFreeName numbers taken names, ignoring case", () => {
  assert.equal(firstFreeName("Sonata", []), "Sonata");
  assert.equal(firstFreeName("Sonata", ["sonata"]), "Sonata (1)");
  assert.equal(firstFreeName("Sonata", ["Sonata", "Sonata (1)", "Sonata (3)"]), "Sonata (2)");
  assert.equal(firstFreeName("Sonata", ["Sonata (1)"]), "Sonata");
});

test("a project whose default name is taken gets the next free number", async () => {
  const names = [];
  for (const [filename, content] of [
    ["Sonata.pdf", "one"],
    ["sonata.pdf", "two"],
    ["SONATA.PDF", "three"],
    ["Sonata (1).pdf", "four"],
    ["So_ata.pdf", "five"],
  ]) {
    names.push((await createdProject(filename, content)).name);
  }
  assert.deepEqual(names, ["Sonata", "sonata (1)", "SONATA (2)", "Sonata (1) (1)", "So_ata"]);
});

test("renaming changes the name and the modification time, not the opening time", async () => {
  const project = await createdProject("sonata.pdf");

  const response = await rename(project.id, "  Sonata, Claude run  ");

  assert.equal(response.status, 200);
  const renamed = (await response.json()) as ProjectJson;
  assert.equal(renamed.name, "Sonata, Claude run");
  assert.ok(renamed.lastModifiedAt >= project.lastModifiedAt);
  assert.equal(renamed.lastOpenedAt, project.lastOpenedAt);
  assert.equal(renamed.createdAt, project.createdAt);
});

test("renaming to a name another project has is refused, ignoring case", async () => {
  await createdProject("sonata.pdf", "one");
  const other = await createdProject("etude.pdf", "two");

  assert.equal((await rename(other.id, "SONATA")).status, 409);
  assert.equal((await rename(other.id, "ETUDE")).status, 200);
  // Ordered by file name.
  assert.deepEqual(
    (await projectRows()).map((row) => row.name),
    ["ETUDE", "sonata"],
  );
});

test("renaming checks the name and the project", async () => {
  const project = await createdProject("sonata.pdf");

  assert.equal((await rename(project.id, "   ")).status, 400);
  assert.equal((await rename(project.id, 42)).status, 400);
  assert.equal((await rename(project.id, "x".repeat(201))).status, 400);
  assert.equal((await rename("no-such-id", "Etude")).status, 404);
});

test("opening a project changes only its opening time", async () => {
  const project = await createdProject("sonata.pdf");
  await new Promise((resolve) => setTimeout(resolve, 5));

  const response = await app.request(`/api/projects/${project.id}/opened`, { method: "POST" }, env);

  assert.equal(response.status, 204);
  const [row] = await projectRows();
  assert.ok((row.last_opened_at as string) > project.lastOpenedAt);
  assert.equal(row.last_modified_at, project.lastModifiedAt);
  assert.equal((await app.request("/api/projects/no-such-id/opened", { method: "POST" }, env)).status, 404);
});

test("the project list is sorted by last opened, most recent first", async () => {
  const first = await createdProject("first.pdf");
  const second = await createdProject("second.pdf");
  await new Promise((resolve) => setTimeout(resolve, 5));
  await app.request(`/api/projects/${first.id}/opened`, { method: "POST" }, env);

  const response = await app.request("/api/projects", {}, env);

  assert.equal(response.status, 200);
  const projects = (await response.json()) as ProjectJson[];
  assert.deepEqual(
    projects.map((p) => p.name),
    ["first", "second"],
  );
  assert.equal(projects[1].id, second.id);
});

test("looking up a PDF lists its projects and the name a new one would get", async () => {
  const pdf = pdfBytes("known pdf");
  const sha256 = await sha256Hex(pdf);
  const first = (await (await postProject({ pdf, filename: "Sonata.pdf", sha256 })).json()) as ProjectJson;
  const second = (await (await postProject({ pdf, filename: "Sonata.pdf", sha256 })).json()) as ProjectJson;
  await createdProject("other.pdf");
  await new Promise((resolve) => setTimeout(resolve, 5));
  await app.request(`/api/projects/${first.id}/opened`, { method: "POST" }, env);

  const response = await app.request(`/api/pdfs/${sha256}?filename=${encodeURIComponent("sonata.pdf")}`, {}, env);

  assert.equal(response.status, 200);
  const body = (await response.json()) as { projects: ProjectJson[]; newProjectName: string };
  assert.deepEqual(
    body.projects.map((p) => p.id),
    [first.id, second.id],
  );
  assert.equal(body.newProjectName, "sonata (2)");
});

test("looking up an unknown PDF finds no projects", async () => {
  const sha256 = await sha256Hex(pdfBytes("unknown pdf"));

  const response = await app.request(`/api/pdfs/${sha256}?filename=Etude.pdf`, {}, env);

  assert.deepEqual(await response.json(), { projects: [], newProjectName: "Etude" });
  assert.equal((await app.request(`/api/pdfs/${sha256}`, {}, env)).status, 400);
  assert.equal((await app.request("/api/pdfs/abc?filename=x.pdf", {}, env)).status, 400);
});

test("a project on a stored PDF can be created without uploading it again", async () => {
  const pdf = pdfBytes("stored pdf");
  const sha256 = await sha256Hex(pdf);
  await postProject({ pdf, filename: "Sonata.pdf", sha256 });

  const response = await postProject({ sha256, filename: "Sonata.pdf", filenameOnly: true });

  assert.equal(response.status, 201);
  const project = (await response.json()) as ProjectJson;
  assert.equal(project.name, "Sonata (1)");
  assert.equal(project.pdfFilename, "Sonata.pdf");
});

test("a project without the file is refused if the PDF isn't stored", async () => {
  const sha256 = await sha256Hex(pdfBytes("never uploaded"));

  const response = await postProject({ sha256, filename: "Sonata.pdf", filenameOnly: true });

  assert.equal(response.status, 409);
  assert.deepEqual(await projectRows(), []);
});

test("a stored PDF can be downloaded by its hash", async () => {
  const pdf = pdfBytes("downloadable pdf");
  const sha256 = await sha256Hex(pdf);
  await postProject({ pdf, filename: "Sonata.pdf", sha256 });

  const response = await app.request(`/api/pdfs/${sha256}/file`, {}, env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), pdf);
  const unknown = await sha256Hex(pdfBytes("never stored"));
  assert.equal((await app.request(`/api/pdfs/${unknown}/file`, {}, env)).status, 404);
  assert.equal((await app.request("/api/pdfs/abc/file", {}, env)).status, 400);
});

// Running stages: what the browser reports while it runs one.

type StageJson = Record<string, unknown> & { id: string; outputs: Record<string, unknown>[] };

async function pipelineOf(projectId: string): Promise<StageJson[]> {
  const response = await app.request(`/api/projects/${projectId}/pipeline`, {}, env);
  return ((await response.json()) as { stages: StageJson[] }).stages;
}

function call(projectId: string, stageId: string, action: string, body?: unknown, method = "POST") {
  return app.request(
    `/api/projects/${projectId}/stages/${stageId}/${action}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
}

const KEY = "c".repeat(64);
const RECIPE_KEY = (n: number) => String(n).repeat(64).slice(0, 64);

async function startRasterize(projectId: string, stageKey = KEY) {
  const [ingest, rasterize] = await pipelineOf(projectId);
  const response = await call(projectId, rasterize.id, "start", {
    stepVersion: 1,
    config: { pages: "1-2", dpi: 300 },
    stageKey,
    pageCount: 2,
    inputIds: [ingest.outputs[0].id],
  });
  return { response, ingest, rasterize };
}

test("a stage runs: started, outputs recorded as they are done, finished", async () => {
  const project = await createdProject("sonata.pdf");
  const { response, ingest, rasterize } = await startRasterize(project.id);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reused: false, stageId: rasterize.id });

  let [, running] = await pipelineOf(project.id);
  assert.equal(running.status, "running");
  assert.equal(running.pageCount, 2);
  assert.deepEqual(running.config, { pages: "1-2", dpi: 300 });
  assert.ok(running.heartbeatAt);

  for (const n of [1, 2]) {
    const recorded = await call(project.id, rasterize.id, "outputs", {
      outputs: [
        { item: `p${n}`, type: "page_image", recipeKey: RECIPE_KEY(n), recipe: { page: n }, inputIds: [ingest.outputs[0].id] },
      ],
    });
    assert.equal(recorded.status, 200);
  }
  // The same item again (e.g. after a retry) is left as it is.
  await call(project.id, rasterize.id, "outputs", {
    outputs: [{ item: "p1", type: "page_image", recipeKey: RECIPE_KEY(3) }],
  });
  assert.equal((await call(project.id, rasterize.id, "heartbeat")).status, 204);
  assert.equal((await call(project.id, rasterize.id, "finish", { status: "done", note: "2 pages" })).status, 204);

  [, running] = await pipelineOf(project.id);
  assert.equal(running.status, "done");
  assert.equal(running.note, "2 pages");
  assert.deepEqual(
    running.outputs.map((o) => [o.item, o.type, o.recipeKey, o.recipe]),
    [
      ["p1", "page_image", RECIPE_KEY(1), { page: 1 }],
      ["p2", "page_image", RECIPE_KEY(2), { page: 2 }],
    ],
  );
  const { results: links } = await env.DB.prepare("SELECT COUNT(*) AS n FROM output_inputs").all<{ n: number }>();
  assert.equal(links[0].n, 2);
  // A finished stage can't start again, nor take outputs.
  assert.equal((await call(project.id, rasterize.id, "start", { stepVersion: 1, config: {}, stageKey: KEY, pageCount: 1, inputIds: [] })).status, 409);
  assert.equal((await call(project.id, rasterize.id, "outputs", { outputs: [] })).status, 409);
});

test("a stage whose key matches a finished one is reused, and the planned stage disappears", async () => {
  const first = await createdProject("sonata.pdf");
  const { rasterize: done } = await startRasterize(first.id);
  await call(first.id, done.id, "finish", { status: "done" });
  const second = await createdProject("sonata.pdf");

  const { response, rasterize: planned } = await startRasterize(second.id);

  assert.deepEqual(await response.json(), { reused: true, stageId: done.id });
  const [, reused] = await pipelineOf(second.id);
  assert.equal(reused.id, done.id);
  assert.equal(await env.DB.prepare("SELECT id FROM stages WHERE id = ?").bind(planned.id).first(), null);
});

test("a failed stage can run again; a running one only once its heartbeat is stale", async () => {
  const project = await createdProject("sonata.pdf");
  const { rasterize } = await startRasterize(project.id);
  assert.equal((await startRasterize(project.id)).response.status, 409);
  assert.equal((await call(project.id, rasterize.id, "finish", { status: "failed", error: "Out of memory" })).status, 204);
  assert.equal((await pipelineOf(project.id))[1].error, "Out of memory");
  assert.equal((await startRasterize(project.id)).response.status, 200);
  await env.DB.prepare("UPDATE stages SET heartbeat_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(rasterize.id).run();
  assert.equal((await startRasterize(project.id)).response.status, 200);
  assert.equal((await call(project.id, rasterize.id, "finish", { status: "failed" })).status, 400);
});

test("a planned stage's config is set in place; a finished stage's config replaces it with a planned one", async () => {
  const project = await createdProject("sonata.pdf");
  const [, planned] = await pipelineOf(project.id);
  assert.equal((await call(project.id, planned.id, "config", { config: { pages: "3" } }, "PUT")).status, 200);
  let [, stage] = await pipelineOf(project.id);
  assert.equal(stage.id, planned.id);
  assert.deepEqual(stage.config, { pages: "3" });

  await startRasterize(project.id);
  await call(project.id, planned.id, "finish", { status: "done" });
  const response = await call(project.id, planned.id, "config", { config: { pages: "4" } }, "PUT");
  assert.equal(response.status, 200);
  [, stage] = await pipelineOf(project.id);
  assert.notEqual(stage.id, planned.id);
  assert.equal(stage.status, "planned");
  assert.deepEqual(stage.config, { pages: "4" });
  // The replaced stage stays, for its key to be found.
  assert.equal((await env.DB.prepare("SELECT status FROM stages WHERE id = ?").bind(planned.id).first())?.status, "done");
  const [ingest] = await pipelineOf(project.id);
  assert.equal((await call(project.id, ingest.id, "config", { config: {} }, "PUT")).status, 409);
});

test("stopping a stage throws its outputs away and puts a planned one with the same config in its place", async () => {
  const project = await createdProject("sonata.pdf");
  const { rasterize } = await startRasterize(project.id);
  await call(project.id, rasterize.id, "outputs", { outputs: [{ item: "p1", type: "page_image", recipeKey: RECIPE_KEY(1) }] });

  const response = await call(project.id, rasterize.id, "stop");

  assert.equal(response.status, 200);
  const [, stage] = await pipelineOf(project.id);
  assert.notEqual(stage.id, rasterize.id);
  assert.equal(stage.status, "planned");
  assert.deepEqual(stage.config, { pages: "1-2", dpi: 300 });
  assert.equal((await env.DB.prepare("SELECT status FROM stages WHERE id = ?").bind(rasterize.id).first())?.status, "stopped");
  assert.equal(await env.DB.prepare("SELECT id FROM outputs WHERE stage_id = ?").bind(rasterize.id).first(), null);
});

test("stage requests check the project, the stage and the body", async () => {
  const project = await createdProject("sonata.pdf");
  const other = await createdProject("etude.pdf");
  const [, rasterize] = await pipelineOf(project.id);
  assert.equal((await call(other.id, rasterize.id, "heartbeat")).status, 404);
  assert.equal((await call(project.id, rasterize.id, "heartbeat")).status, 409);
  assert.equal((await call(project.id, rasterize.id, "start", { stepVersion: 1 })).status, 400);
  assert.equal((await call(project.id, rasterize.id, "config", { pages: "1" }, "PUT")).status, 400);
});

// Manual stages: added after a done stage, worked on while WIP, finished, edited and dropped.

const LINES = (n: number) => String.fromCharCode(96 + n).repeat(64); // 'aaa…', 'bbb…'

// A project whose rasterize and skew_analysis are done, with one skew output per page.
async function analyzedProject(filename: string) {
  const project = await createdProject(filename);
  const { rasterize } = await startRasterize(project.id, RECIPE_KEY(7));
  await call(project.id, rasterize.id, "outputs", {
    outputs: [1, 2].map((n) => ({ item: `p${n}`, type: "page_image", recipeKey: RECIPE_KEY(n) })),
  });
  await call(project.id, rasterize.id, "finish", { status: "done" });
  const skew = (await pipelineOf(project.id))[2];
  await call(project.id, skew.id, "start", {
    stepVersion: 1,
    config: { maxAngle: 5 },
    stageKey: RECIPE_KEY(8),
    pageCount: 2,
    inputIds: [],
  });
  await call(project.id, skew.id, "outputs", {
    outputs: [1, 2].map((n) => ({ item: `p${n}`, type: "skew", contentSha256: LINES(n) })),
  });
  await call(project.id, skew.id, "finish", { status: "done" });
  const stages = await pipelineOf(project.id);
  return { project, skew: stages[2], stages };
}

function addFix(projectId: string, stageId: string, step = "fix_skew") {
  return call(projectId, stageId, "fix", { step, stepVersion: 1, pageCount: 2, inputIds: [] });
}

test("a manual stage is added WIP after a done stage, saved as the user works, and finished", async () => {
  const { project, skew, stages } = await analyzedProject("fix.pdf");
  const response = await addFix(project.id, skew.id);
  assert.equal(response.status, 200);
  const { stageId } = (await response.json()) as { stageId: string };

  let pipeline = await pipelineOf(project.id);
  assert.deepEqual(
    pipeline.map((s) => [s.step, s.status]),
    [["ingest", "done"], ["rasterize", "done"], ["skew_analysis", "done"], ["fix_skew", "wip"], ["layout", "planned"], ["analyze", "planned"], ["extract", "planned"], ["engrave", "planned"]],
  );
  // The planned layout keeps its row.
  assert.equal(pipeline[4].id, stages[3].id);

  // Saving a page again overwrites it.
  const parent = skew.outputs[0].id;
  await call(project.id, stageId, "outputs", {
    outputs: [{ item: "p1", type: "lines", contentSha256: LINES(1), parentOutputId: parent }],
  });
  await call(project.id, stageId, "outputs", {
    outputs: [{ item: "p1", type: "lines", contentSha256: LINES(3), parentOutputId: parent }],
  });
  pipeline = await pipelineOf(project.id);
  assert.deepEqual(pipeline[3].outputs.map((o) => [o.item, o.contentSha256]), [["p1", LINES(3)]]);

  // A WIP stage can't fail or start; it can be finished.
  assert.equal((await call(project.id, stageId, "finish", { status: "failed", error: "x" })).status, 409);
  assert.equal((await call(project.id, stageId, "finish", { status: "done", note: "1 page changed" })).status, 204);
  pipeline = await pipelineOf(project.id);
  assert.equal(pipeline[3].status, "done");
  assert.equal(pipeline[3].note, "1 page changed");
  // A done stage's outputs can't change any more.
  const late = await call(project.id, stageId, "outputs", {
    outputs: [{ item: "p2", type: "lines", contentSha256: LINES(2) }],
  });
  assert.equal(late.status, 409);
});

test("a fix can't follow the same stage twice, nor a stage that isn't done, nor be anything but manual", async () => {
  const { project, skew, stages } = await analyzedProject("twice.pdf");
  assert.equal((await addFix(project.id, skew.id)).status, 200);
  assert.equal((await addFix(project.id, skew.id)).status, 409);
  assert.equal((await addFix(project.id, stages[3].id)).status, 409); // layout, planned
  assert.equal((await addFix(project.id, skew.id, "layout")).status, 400);
});

test("a second fix of the same stage goes after the first, which stays, WIP or finished", async () => {
  const { project, skew } = await analyzedProject("second.pdf");
  const { stageId: first } = (await (await addFix(project.id, skew.id)).json()) as { stageId: string };
  // (Any manual step can be sent; which fixes fit after which stage is the app's business.)
  const response = await addFix(project.id, skew.id, "fix_layout");
  assert.equal(response.status, 200);
  const pipeline = await pipelineOf(project.id);
  assert.deepEqual(
    pipeline.map((s) => [s.step, s.status]),
    [["ingest", "done"], ["rasterize", "done"], ["skew_analysis", "done"], ["fix_skew", "wip"], ["fix_layout", "wip"], ["layout", "planned"], ["analyze", "planned"], ["extract", "planned"], ["engrave", "planned"]],
  );
  assert.equal(pipeline[3].id, first);
  // Neither can be added again after the same stage.
  assert.equal((await addFix(project.id, skew.id)).status, 409);
  assert.equal((await addFix(project.id, skew.id, "fix_layout")).status, 409);
});

test("adding a fix replaces the stages after it that ran; a change before a manual stage drops it", async () => {
  const { project, skew } = await analyzedProject("replace.pdf");
  const layout = (await pipelineOf(project.id))[3];
  await call(project.id, layout.id, "start", { stepVersion: 1, config: {}, stageKey: RECIPE_KEY(9), pageCount: 2, inputIds: [] });
  await call(project.id, layout.id, "finish", { status: "done" });

  await addFix(project.id, skew.id);
  let pipeline = await pipelineOf(project.id);
  assert.equal(pipeline[4].step, "layout");
  assert.equal(pipeline[4].status, "planned");
  assert.notEqual(pipeline[4].id, layout.id);

  // A config change in rasterize: skew_analysis and layout get planned copies, fix_skew goes.
  await call(project.id, pipeline[1].id, "config", { config: { pages: "1", dpi: 300 } }, "PUT");
  pipeline = await pipelineOf(project.id);
  assert.deepEqual(
    pipeline.map((s) => [s.step, s.status]),
    [["ingest", "done"], ["rasterize", "planned"], ["skew_analysis", "planned"], ["layout", "planned"], ["analyze", "planned"], ["extract", "planned"], ["engrave", "planned"]],
  );
});

test("editing a finished manual stage puts a WIP copy in its place; the old one stays", async () => {
  const { project, skew } = await analyzedProject("edit.pdf");
  const { stageId } = (await (await addFix(project.id, skew.id)).json()) as { stageId: string };
  await call(project.id, stageId, "outputs", {
    outputs: [1, 2].map((n) => ({ item: `p${n}`, type: "lines", contentSha256: LINES(n), parentOutputId: skew.outputs[n - 1].id })),
  });
  // Only a finished manual stage can be edited.
  assert.equal((await call(project.id, stageId, "edit")).status, 409);
  assert.equal((await call(project.id, skew.id, "edit")).status, 409);
  await call(project.id, stageId, "finish", { status: "done" });

  const response = await call(project.id, stageId, "edit");
  assert.equal(response.status, 200);
  const edited = ((await response.json()) as { stageId: string }).stageId;
  const pipeline = await pipelineOf(project.id);
  assert.equal(pipeline[3].id, edited);
  assert.equal(pipeline[3].status, "wip");
  assert.deepEqual(pipeline[3].outputs.map((o) => [o.item, o.contentSha256]), [["p1", LINES(1)], ["p2", LINES(2)]]);
  const old = await env.DB.prepare("SELECT status FROM stages WHERE id = ?").bind(stageId).first<{ status: string }>();
  assert.equal(old?.status, "done");
  const row = await env.DB.prepare("SELECT replaces_stage_id FROM stages WHERE id = ?").bind(edited).first();
  assert.equal(row?.replaces_stage_id, stageId);
});

test("dropping a manual stage takes it out and moves the later stages up; recipe stages can't be dropped", async () => {
  const { project, skew } = await analyzedProject("drop.pdf");
  const { stageId } = (await (await addFix(project.id, skew.id)).json()) as { stageId: string };
  assert.equal((await call(project.id, skew.id, "drop")).status, 409);
  assert.equal((await call(project.id, stageId, "drop")).status, 200);
  const pipeline = await pipelineOf(project.id);
  assert.deepEqual(pipeline.map((s) => s.step), ["ingest", "rasterize", "skew_analysis", "layout", "analyze", "extract", "engrave"]);
  const { results } = await env.DB.prepare("SELECT position FROM pipeline_entries WHERE project_id = ? ORDER BY position")
    .bind(project.id)
    .all<{ position: number }>();
  assert.deepEqual(results.map((r) => r.position), [1, 2, 3, 4, 5, 6, 7]);
});

test("issue numbers are reserved per project, never twice", async () => {
  const project = await createdProject("issues.pdf");
  const reserve = async (count: unknown) =>
    app.request(`/api/projects/${project.id}/issue-numbers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }) }, env);
  assert.deepEqual(await (await reserve(3)).json(), { first: 1 });
  assert.deepEqual(await (await reserve(2)).json(), { first: 4 });
  assert.equal((await reserve(0)).status, 400);
  const other = await createdProject("other.pdf");
  const response = await app.request(`/api/projects/${other.id}/issue-numbers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 1 }) }, env);
  assert.deepEqual(await response.json(), { first: 1 });
});

test("migration 0014 adds the fake model config as the default, once, and keeps a default already chosen", async () => {
  const config = await env.DB.prepare("SELECT name, provider, model, free_tier FROM model_configs WHERE id = 'fake-model'").first();
  assert.deepEqual(config, { name: "Fake model", provider: "fake", model: "fake", free_tier: 1 });
  const setting = async () => (await env.DB.prepare("SELECT value_json FROM settings WHERE key = 'defaultModelConfigId'").first())?.value_json;
  assert.equal(await setting(), '"fake-model"');
  // Run again with another default: nothing changes.
  await env.DB.prepare("UPDATE settings SET value_json = '\"other\"' WHERE key = 'defaultModelConfigId'").run();
  await env.DB.exec(withoutComments(readFileSync(join(workerDir, "migrations", "0014_fake_model_config.sql"), "utf8")));
  assert.equal(await setting(), '"other"');
  assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM model_configs WHERE provider = 'fake'").first())?.n, 1);
});
