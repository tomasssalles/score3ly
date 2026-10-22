import { Hono } from "hono";
import { defaultName, firstFreeName, MAX_NAME_LENGTH } from "./names.ts";
import { llmRoutes, readSettings } from "./llmRoutes.ts";
import { newPipeline, pipelineRoutes } from "./pipeline.ts";

export type Project = {
  id: string;
  name: string; // unique (case-insensitive), chosen by the user; defaults to the PDF's file name
  pdfSha256: string;
  pdfFilename: string; // the file's name when the project was created
  createdAt: string; // ISO 8601, UTC
  lastModifiedAt: string; // any change to the project's own data, a rename included
  lastOpenedAt: string;
  runMode: RunMode;
};

export type RunMode = "auto" | "manual";

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

function isNameConflict(err: unknown): boolean {
  return String(err).includes("UNIQUE constraint failed: projects.name");
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

async function getProject(db: D1Database, id: string): Promise<Project | null> {
  const row = await db
    .prepare("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<ProjectRow>();
  return row && toProject(row);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// All projects, most recently opened first.
app.get("/api/projects", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY last_opened_at DESC, created_at DESC",
  ).all<ProjectRow>();
  return c.json(results.map(toProject));
});

async function takenNames(db: D1Database, base: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT name FROM projects WHERE deleted_at IS NULL AND (name = ? OR name LIKE ? ESCAPE '\\')")
    .bind(base, `${escapeLike(base)} (%)`)
    .all<{ name: string }>();
  return results.map((row) => row.name);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function pdfKey(sha256: string): string {
  return `pdfs/${sha256}.pdf`;
}

// What is known about a PDF before uploading it: its projects, most recently opened first, and the name a
// new project on it would get (a hint: another project may take that name first).
app.get("/api/pdfs/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  const filename = c.req.query("filename");
  if (!isSha256(sha256) || filename === undefined) {
    return c.json({ error: "expected a SHA-256 in lowercase hex and a 'filename'" }, 400);
  }
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE pdf_sha256 = ? AND deleted_at IS NULL ORDER BY last_opened_at DESC, created_at DESC",
  )
    .bind(sha256)
    .all<ProjectRow>();
  const base = defaultName(filename);
  return c.json({
    projects: results.map(toProject),
    newProjectName: firstFreeName(base, await takenNames(c.env.DB, base)),
  });
});

// The PDF itself. Its key is its content's hash, so it never changes and can be cached for good.
app.get("/api/pdfs/:sha256/file", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256(sha256)) {
    return c.json({ error: "expected a SHA-256 in lowercase hex" }, 400);
  }
  const object = await c.env.PDFS.get(pdfKey(sha256));
  if (!object) {
    return c.json({ error: "no such PDF" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

// Stored outputs' content (DESIGN.md §2): any file, in R2 under the SHA-256 of its bytes, which R2 checks. Storing
// the same content again is harmless. Objects never change, so they can be cached for good.
function contentKey(sha256: string): string {
  return `content/${sha256}`;
}

app.put("/api/content/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256(sha256)) return c.json({ error: "expected a SHA-256 in lowercase hex" }, 400);
  const body = await c.req.arrayBuffer();
  try {
    await c.env.PDFS.put(contentKey(sha256), body, {
      sha256,
      httpMetadata: { contentType: c.req.header("Content-Type") ?? "application/octet-stream" },
    });
  } catch {
    return c.json({ error: "the content doesn't match its SHA-256" }, 400);
  }
  return c.body(null, 204);
});

app.get("/api/content/:sha256", async (c) => {
  const sha256 = c.req.param("sha256");
  if (!isSha256(sha256)) return c.json({ error: "expected a SHA-256 in lowercase hex" }, 400);
  const object = await c.env.PDFS.get(contentKey(sha256));
  if (!object) return c.json({ error: "no such content" }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});

// Creates a project, with its pipeline: Ingest, done from the start, its output the PDF (DESIGN.md §5.1), and the
// recipe's other stages, planned.
// The form has the PDF's 'sha256' and either the 'pdf' itself, which is stored in R2, or
// only its 'filename' if R2 already has it.
app.post("/api/projects", async (c) => {
  const form = await c.req.formData();
  const pdf = form.get("pdf");
  const sha256 = form.get("sha256");
  const filenameField = form.get("filename");
  if (!isSha256(sha256) || !(pdf instanceof File || typeof filenameField === "string")) {
    return c.json({ error: "expected a 'pdf' file or its 'filename', and its 'sha256' in lowercase hex" }, 400);
  }

  let filename: string;
  if (pdf instanceof File) {
    // R2 checks the bytes against the hash and refuses the upload if they differ.
    try {
      await c.env.PDFS.put(pdfKey(sha256), await pdf.arrayBuffer(), { sha256 });
    } catch {
      return c.json({ error: "the PDF doesn't match its SHA-256" }, 400);
    }
    filename = pdf.name;
  } else {
    if (!(await c.env.PDFS.head(pdfKey(sha256)))) {
      return c.json({ error: "this PDF isn't stored yet: send the file itself" }, 409);
    }
    filename = filenameField as string;
  }

  const now = new Date().toISOString();
  const base = defaultName(filename);
  const { newProjectRunMode } = await readSettings(c.env.DB);
  // Another project may take the chosen name between the lookup and the insert: then look again.
  for (let attempt = 0; ; attempt++) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: firstFreeName(base, await takenNames(c.env.DB, base)),
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
        ...newPipeline(db, project.id, project.pdfSha256, now),
      ]);
      return c.json(project, 201);
    } catch (err) {
      if (!isNameConflict(err) || attempt >= 4) throw err;
    }
  }
});

// Renames a project, or sets its run mode, or both. A name that is already taken is refused, not numbered.
app.patch("/api/projects/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const sets: string[] = [];
  const values: unknown[] = [];
  let name: string | undefined;
  if (body?.name !== undefined) {
    name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      return c.json({ error: `expected a 'name' of 1 to ${MAX_NAME_LENGTH} characters` }, 400);
    }
    sets.push("name = ?");
    values.push(name);
  }
  if (body?.runMode !== undefined) {
    if (body.runMode !== "auto" && body.runMode !== "manual") {
      return c.json({ error: "expected a 'runMode' of 'auto' or 'manual'" }, 400);
    }
    sets.push("run_mode = ?");
    values.push(body.runMode);
  }
  if (sets.length === 0) {
    return c.json({ error: "expected a 'name' or a 'runMode'" }, 400);
  }
  try {
    const result = await c.env.DB.prepare(
      `UPDATE projects SET ${sets.join(", ")}, last_modified_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(...values, new Date().toISOString(), c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return c.json({ error: "no such project" }, 404);
  } catch (err) {
    if (isNameConflict(err)) return c.json({ error: `another project is already called "${name}"` }, 409);
    throw err;
  }
  return c.json(await getProject(c.env.DB, c.req.param("id")));
});

// Records that the project was opened. Doesn't count as a modification.
app.post("/api/projects/:id/opened", async (c) => {
  const result = await c.env.DB.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(new Date().toISOString(), c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return c.json({ error: "no such project" }, 404);
  return c.body(null, 204);
});

// Reserves `count` issue numbers (DESIGN.md §6, "Issue ids"): a short number per project, never reused, not even after
// a re-run drops the issue. Returns the first; the others follow it.
app.post("/api/projects/:id/issue-numbers", async (c) => {
  const body = await c.req.json().catch(() => null);
  const count = body?.count;
  if (!Number.isInteger(count) || count < 1 || count > 1000) return c.json({ error: "expected a 'count' from 1 to 1000" }, 400);
  const row = await c.env.DB.prepare(
    "UPDATE projects SET next_issue_number = next_issue_number + ? WHERE id = ? AND deleted_at IS NULL RETURNING next_issue_number",
  )
    .bind(count, c.req.param("id"))
    .first<{ next_issue_number: number }>();
  if (!row) return c.json({ error: "no such project" }, 404);
  return c.json({ first: row.next_issue_number - count });
});

pipelineRoutes(app);
llmRoutes(app);

export default app;
