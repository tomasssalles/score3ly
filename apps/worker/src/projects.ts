// Projects (docs/overview.md §4): listing, a PDF's lookup, creating, renaming, opening, issue numbers, deleting; and
// `insertProject`, the one place a new project gets its name (a create, an import).

import type { Hono } from "hono";
import type { Deleted, ListedProject, PdfLookup, PipelinePosition, Project, RunMode } from "@score3ly/core";
import { firstFreeName, isSha256Hex, MAX_NAME_LENGTH, nameTooLong } from "@score3ly/core";
import { deleteProject } from "./deletion.ts";
import { defaultName, nameBase } from "./names.ts";
import { readSettings } from "./settings.ts";
import { defaultForNewStages, newPipeline, notDone, wasInterrupted } from "./pipelineRules.ts";
import { lock } from "./versions.ts";
import { badRequest, NO_PROJECT, refuse } from "./refusals.ts";
import { pdfKey, storePdf } from "./storage.ts";

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
  const row = await db.prepare("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL").bind(id).first<ProjectRow>();
  return row && toProject(row);
}

// Every name in use: firstFreeName picks from them in code. Not with LIKE: D1 refuses patterns over 50 bytes, and
// file names are often longer (docs/overview.md §4). There are never so many projects that this matters. An unfinished
// import's name is taken too, as the unique index says.
async function takenNames(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare("SELECT name FROM projects WHERE deleted_at IS NULL").all<{ name: string }>();
  return results.map((row) => row.name);
}

// Makes a new project under the first free name from `base` (`firstFreeName`): `statements(name)` are the project's
// row and whatever comes with it, written in one batch (one transaction). Another project may take the name between
// the look and the insert: then it looks again (at most five times). Returns the name given. Used by a create and by an
// import's head, so that both number names the same way (the code review's E14).
export async function insertProject(db: D1Database, base: string, statements: (name: string) => D1PreparedStatement[]): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const name = firstFreeName(base, await takenNames(db));
    try {
      await db.batch(statements(name));
      return name;
    } catch (err) {
      if (!isNameConflict(err) || attempt >= 4) throw err;
    }
  }
}

export function projectRoutes(app: Hono<{ Bindings: Env }>) {
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
      db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL AND importing IS NULL ORDER BY last_opened_at DESC, created_at DESC"),
      db.prepare(
        `SELECT e.project_id, s.step, s.status, s.heartbeat_at, s.error, e.carried
         FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id
         WHERE e.position = (
           SELECT MIN(f.position) FROM pipeline_entries f JOIN stages t ON t.id = f.stage_id
           WHERE f.project_id = e.project_id AND ${notDone("t", "f")}
         )`,
      ),
    ]);
    type PositionRow = { project_id: string; step: string; status: PipelinePosition["status"]; heartbeat_at: string | null; error: string | null; carried: number };
    const now = Date.now();
    const at = new Map(
      (positions.results as PositionRow[]).map((r) => [
        r.project_id,
        { step: r.step, status: r.status, interrupted: wasInterrupted(r, now), carried: r.carried === 1 } satisfies PipelinePosition,
      ]),
    );
    return c.json<ListedProject[]>((projects.results as ProjectRow[]).map((row): ListedProject => ({ ...toProject(row), current: at.get(row.id) ?? null })));
  });

  // What is known about a PDF before uploading it: its projects, most recently opened first, and the name a new project
  // on it would get (a hint: another project may take that name first), from the PDF's 'filename' (a new project) or
  // from a 'name' (an imported project's).
  app.get("/api/pdfs/:sha256", async (c) => {
    const sha256 = c.req.param("sha256");
    const filename = c.req.query("filename");
    const name = c.req.query("name");
    if (!isSha256Hex(sha256) || (filename === undefined) === (name === undefined)) {
      return badRequest(c, "expected a SHA-256 in lowercase hex and a 'filename' or a 'name'");
    }
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL AND importing IS NULL ORDER BY last_opened_at DESC, created_at DESC",
    )
      .bind(sha256)
      .all<ProjectRow>();
    const base = filename !== undefined ? defaultName(filename) : nameBase(name!);
    return c.json<PdfLookup>({
      projects: results.map(toProject),
      newProjectName: firstFreeName(base, await takenNames(c.env.DB)),
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
      if ((await storePdf(c.env.STORE, sha256, await pdf.arrayBuffer())) === "mismatch") {
        return refuse(c, 400, "The PDF arrived damaged. Try again. Details: it doesn't match its SHA-256.");
      }
      filename = pdf.name;
    } else {
      if (!(await c.env.STORE.head(pdfKey(sha256)))) {
        return refuse(c, 409, "The server doesn't have this PDF yet. Try again. Details: send the file itself, not only its 'filename'.");
      }
      filename = filenameField as string;
    }

    const now = new Date().toISOString();
    const db = c.env.DB;
    const { newProjectRunMode } = await readSettings(db);
    const defaultModelConfigId = await defaultForNewStages(db);
    const id = crypto.randomUUID();
    const project = (name: string): Project => ({
      id,
      name,
      pdfSha256: sha256,
      pdfFilename: filename,
      createdAt: now,
      lastModifiedAt: now,
      lastOpenedAt: now,
      runMode: newProjectRunMode,
    });
    // The project never exists without its pipeline.
    const name = await insertProject(db, defaultName(filename), (name) => [
      db
        .prepare("INSERT INTO projects (id, name, pdf_sha256, pdf_filename, run_mode, created_at, last_modified_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, name, sha256, filename, newProjectRunMode, now, now, now),
      ...newPipeline(db, id, sha256, defaultModelConfigId, now),
    ]);
    return c.json<Project>(project(name), 201);
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
      const result = await c.env.DB.prepare(`UPDATE projects SET ${sets.join(", ")}, last_modified_at = ? WHERE id = ? AND deleted_at IS NULL`)
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
}
