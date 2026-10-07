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
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM projects");
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
    },
  ]);

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

test("a hash that doesn't match the PDF creates nothing", async () => {
  const pdf = pdfBytes("third pdf");
  const wrongSha256 = await sha256Hex(pdfBytes("something else"));

  const response = await postProject({ pdf, sha256: wrongSha256 });

  assert.equal(response.ok, false);
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
