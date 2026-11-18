import { Hono } from "hono";
import { activityRoutes } from "./activity.ts";
import { costRoutes } from "./costs.ts";
import { projectStatsRoutes } from "./projectStats.ts";
import { failureRoutes } from "./failures.ts";
import { runTimeRoutes } from "./runTimes.ts";
import { deleteProject } from "./deletion.ts";
import { defaultName } from "./names.ts";
import { fingerprintRoutes } from "./fingerprints.ts";
import { convertAddedConfigs, modelConfigRoutes } from "./modelConfigs.ts";
import { readSettings, settingsRoutes } from "./settings.ts";
import { llmCallRoutes } from "./llmCalls.ts";
import { pipelineRoutes } from "./pipeline.ts";
import { defaultForNewStages, newPipeline, stageEntries } from "./pipelineRules.ts";
import { lock, versionRoutes } from "./versions.ts";
import { projectFileRoutes } from "./projectFile.ts";
import { requestLog } from "./requestLog.ts";
import { badRequest, failed, NO_PROJECT, refuse } from "./refusals.ts";
import { putChecked } from "./storage.ts";

export type { ListedProject, Project, RunMode } from "@score3ly/core";
import type { Deleted, Info, ListedProject, PdfLookup, PipelinePosition, Project, RunMode } from "@score3ly/core";
import { firstFreeName, isSha256Hex, MAX_NAME_LENGTH, nameTooLong } from "@score3ly/core";

type ProjectRow = {
  id: string;
  name: string;
  pdf_sha256: string;
  pdf_filename: string;
  created_at: string;
  last_modified_at: string;
  last_opened_at: string;
  run_mode: RunMode;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    pdfSha256: row.pdf_sha256,
    pdfFilename: row.pdf_filename,
    createdAt: row.created_at,
    lastModifiedAt: row.last_modified_at,
    lastOpenedAt: row.last_opened_at,
    runMode: row.run_mode,
  };
}

const PROJECT_NAME_TAKEN = "A project with that name already exists. Names must be unique (case-insensitive).";

function isNameConflict(err: unknown): boolean {
  return String(err).includes("UNIQUE constraint failed: projects.name");
}

async function getProject(db: D1Database, id: string): Promise<Project | null> {
  const row = await db
    .prepare("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<ProjectRow>();
  return row && toProject(row);
}

const app = new Hono<{ Bindings: Env }>();

// Anything a route throws is answered as JSON like a refusal, with the code "internal" (docs/style.md, "Error texts").
app.onError(failed);

// A log line of our own per API request, for Workers Logs (requestLog.ts).
app.use("/api/*", requestLog);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Optimistic locking: before the project's routes, so that a stale change is refused before anything happens.
versionRoutes(app);

// Before anything reads model configs: those added by hand whose string a new list of models has become listed ones
// (docs/llm.md, "Configs"); once per list, then nothing.
app.use("/api/*", async (c, next) => {
  await convertAddedConfigs(c.env.DB);
  await next();
});

// Which host serves the app (docs/desktop.md, "What differs in the app"): here Cloudflare. The desktop version's server
// answers this itself ("desktop" in Electron, "local" as a plain local server), so the web bundle stays the same and
// the app asks rather than guessing.
app.get("/api/info", (c) => c.json<Info>({ host: "cloudflare" }));

// Deletes a project (docs/database.md, "Deleting a project"): refused while one of its stages runs, here or on another device.
app.delete("/api/projects/:id", lock("none"), async (c) => {
  const result = await deleteProject(c.env, c.req.param("id"));
  if (result === "not_found") return refuse(c, 404, NO_PROJECT);
  if (result === "running") return refuse(c, 409, "The project can't be deleted while one of its stages is running. Stop it, or let it finish, then try again.", "running");
  return c.json<Deleted>(result);
});

// All projects, most recently opened first, each with where its pipeline is (its first stage that isn't done, a carried
// one included), for the home's cards (docs/project-view.md, "The home").
app.get("/api/projects", async (c) => {
  const db = c.env.DB;
  const [projects, positions] = await db.batch([
    db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY last_opened_at DESC, created_at DESC"),
    db.prepare(
      `SELECT e.project_id, s.step, s.status, s.heartbeat_at, e.carried
       FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id
       WHERE e.position = (
         SELECT MIN(f.position) FROM pipeline_entries f JOIN stages t ON t.id = f.stage_id
         WHERE f.project_id = e.project_id AND (t.status <> 'done' OR f.carried = 1)
       )`,
    ),
  ]);
  type PositionRow = { project_id: string; step: string; status: PipelinePosition["status"]; heartbeat_at: string | null; carried: number };
  const at = new Map(
    (positions.results as PositionRow[]).map((r) => [
      r.project_id,
      { step: r.step, status: r.status, heartbeatAt: r.heartbeat_at, carried: r.carried === 1 } satisfies PipelinePosition,
    ]),
  );
  return c.json<ListedProject[]>((projects.results as ProjectRow[]).map((row): ListedProject => ({ ...toProject(row), current: at.get(row.id) ?? null })));
});

// Every name in use: firstFreeName picks from them in code. Not with LIKE: D1 refuses patterns over 50 bytes, and
// file names are often longer (docs/overview.md §4). There are never so many projects that this matters.
async function takenNames(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare("SELECT name FROM projects WHERE deleted_at IS NULL").all<{ name: string }>();
  return results.map((row) => row.name);
}

function pdfKey(sha256: string): string {
  return `pdfs/${sha256}.pdf`;
}

// What is known about a PDF before uploading it: its projects, most recently opened first, and the name a
// new project on it would get (a hint: another project may take that name first).
app.get("/api/pdfs/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  const filename = c.req.query("filename");
  if (!isSha256Hex(sha256) || filename === undefined) {
    return badRequest(c, "expected a SHA-256 in lowercase hex and a 'filename'");
  }
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL ORDER BY last_opened_at DESC, created_at DESC",
  )
    .bind(sha256)
    .all<ProjectRow>();
  const base = defaultName(filename);
  return c.json<PdfLookup>({
    projects: results.map(toProject),
    newProjectName: firstFreeName(base, await takenNames(c.env.DB)),
  });
});

// The PDF itself. Its key is its content's hash, so it never changes and can be cached for good.
app.get("/api/pdfs/:sha256/file", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256Hex(sha256)) {
    return badRequest(c, "expected a SHA-256 in lowercase hex");
  }
  const object = await c.env.PDFS.get(pdfKey(sha256));
  if (!object) {
    return refuse(c, 404, "The server doesn't have this PDF.");
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

// Stored outputs' content (docs/overview.md §2): any file, in R2 under the SHA-256 of its bytes, which R2 checks. Storing
// the same content again is harmless. Objects never change, so they can be cached for good.
function contentKey(sha256: string): string {
  return `content/${sha256}`;
}

app.put("/api/content/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
  const body = await c.req.arrayBuffer();
  const stored = await putChecked(c.env.PDFS, contentKey(sha256), body, sha256, {
    httpMetadata: { contentType: c.req.header("Content-Type") ?? "application/octet-stream" },
  });
  if (stored === "mismatch") return refuse(c, 400, "The content arrived damaged. Try again. Details: it doesn't match its SHA-256.");
  return c.body(null, 204);
});

app.get("/api/content/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256Hex(sha256)) return badRequest(c, "expected a SHA-256 in lowercase hex");
  const object = await c.env.PDFS.get(contentKey(sha256));
  if (!object) return refuse(c, 404, "The server doesn't have this stored content.");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

// Creates a project, with its pipeline: Ingest, done from the start, its output the PDF (docs/overview.md §5.1), and the
// recipe's other stages, planned.
// The form has the PDF's 'sha256' and either the 'pdf' itself, which is stored in R2, or
// only its 'filename' if R2 already has it.
app.post("/api/projects", async (c) => {
  const form = await c.req.formData();
  const pdf = form.get("pdf");
  const sha256 = form.get("sha256");
  const filenameField = form.get("filename");
  if (!isSha256Hex(sha256) || !(pdf instanceof File || typeof filenameField === "string")) {
    return badRequest(c, "expected a 'pdf' file or its 'filename', and its 'sha256' in lowercase hex");
  }

  let filename: string;
  if (pdf instanceof File) {
    // R2 checks the bytes against the hash and refuses the upload if they differ.
    if ((await putChecked(c.env.PDFS, pdfKey(sha256), await pdf.arrayBuffer(), sha256)) === "mismatch") {
      return refuse(c, 400, "The PDF arrived damaged. Try again. Details: it doesn't match its SHA-256.");
    }
    filename = pdf.name;
  } else {
    if (!(await c.env.PDFS.head(pdfKey(sha256)))) {
      return refuse(c, 409, "The server doesn't have this PDF yet. Try again. Details: send the file itself, not only its 'filename'.");
    }
    filename = filenameField as string;
  }

  const now = new Date().toISOString();
  const base = defaultName(filename);
  const { newProjectRunMode } = await readSettings(c.env.DB);
  const defaultModelConfigId = await defaultForNewStages(c.env.DB);
  // Another project may take the chosen name between the lookup and the insert: then look again.
  for (let attempt = 0; ; attempt++) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: firstFreeName(base, await takenNames(c.env.DB)),
      pdfSha256: sha256,
      pdfFilename: filename,
      createdAt: now,
      lastModifiedAt: now,
      lastOpenedAt: now,
      runMode: newProjectRunMode,
    };
    const db = c.env.DB;
    try {
      // A batch is one transaction: the project never exists without its pipeline.
      await db.batch([
        db
          .prepare(
            "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, run_mode, created_at, last_modified_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            project.id,
            project.name,
            project.pdfSha256,
            project.pdfFilename,
            project.runMode,
            project.createdAt,
            project.lastModifiedAt,
            project.lastOpenedAt,
          ),
        ...newPipeline(db, project.id, project.pdfSha256, defaultModelConfigId, now),
      ]);
      return c.json<Project>(project, 201);
    } catch (err) {
      if (!isNameConflict(err) || attempt >= 4) throw err;
    }
  }
});

// Renames a project, or sets its run mode, or both. A name that is already taken is refused, not numbered.
app.patch("/api/projects/:id", lock("checked"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const sets: string[] = [];
  const values: unknown[] = [];
  let name: string | undefined;
  if (body?.name !== undefined) {
    name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || nameTooLong(name)) {
      return badRequest(c, `expected a 'name' of 1 to ${MAX_NAME_LENGTH} characters`);
    }
    sets.push("name = ?");
    values.push(name);
  }
  if (body?.runMode !== undefined) {
    if (body.runMode !== "auto" && body.runMode !== "manual") {
      return badRequest(c, "expected a 'runMode' of 'auto' or 'manual'");
    }
    sets.push("run_mode = ?");
    values.push(body.runMode);
  }
  if (sets.length === 0) {
    return badRequest(c, "expected a 'name' or a 'runMode'");
  }
  try {
    const result = await c.env.DB.prepare(
      `UPDATE projects SET ${sets.join(", ")}, last_modified_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(...values, new Date().toISOString(), c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return refuse(c, 404, NO_PROJECT);
  } catch (err) {
    if (isNameConflict(err)) return refuse(c, 409, PROJECT_NAME_TAKEN, "name_taken");
    throw err;
  }
  return c.json<Project | null>(await getProject(c.env.DB, c.req.param("id")));
});

// Records that the project was opened. Doesn't count as a modification.
app.post("/api/projects/:id/opened", lock("none"), async (c) => {
  const result = await c.env.DB.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(new Date().toISOString(), c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return refuse(c, 404, NO_PROJECT);
  return c.body(null, 204);
});

// Reserves `count` issue numbers (docs/notation.md, "Issue ids"): a short number per project, never reused, not even after
// a re-run drops the issue. Returns the first; the others follow it. `above` (optional): the largest number the caller
// already knows of among the issues it works on, which may come from another project's counter (stages reused from the
// stage cache): the numbers continue above it.
app.post("/api/projects/:id/issue-numbers", lock("none"), async (c) => {
  const body = await c.req.json().catch(() => null);
  const count = body?.count;
  const above = body?.above ?? 0;
  if (!Number.isInteger(count) || count < 1 || count > 1000) return badRequest(c, "expected a 'count' from 1 to 1000");
  if (!Number.isInteger(above) || above < 0) return badRequest(c, "'above' must be a number of 0 or more");
  const row = await c.env.DB.prepare(
    "UPDATE projects SET next_issue_number = MAX(next_issue_number, ? + 1) + ? WHERE id = ? AND deleted_at IS NULL RETURNING next_issue_number",
  )
    .bind(above, count, c.req.param("id"))
    .first<{ next_issue_number: number }>();
  if (!row) return refuse(c, 404, NO_PROJECT);
  return c.json({ first: row.next_issue_number - count });
});

// Every route about a stage reads its entry first (pipelineRules.ts).
stageEntries(app);
pipelineRoutes(app);
modelConfigRoutes(app);
settingsRoutes(app);
llmCallRoutes(app);
projectFileRoutes(app);
fingerprintRoutes(app);
costRoutes(app);
activityRoutes(app);
projectStatsRoutes(app);
failureRoutes(app);
runTimeRoutes(app);

export default app;
