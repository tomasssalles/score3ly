import { Hono } from "hono";
import { defaultName, firstFreeName, MAX_NAME_LENGTH } from "./names.ts";

export type Project = {
  id: string;
  name: string; // unique (case-insensitive), chosen by the user; defaults to the PDF's file name
  pdfSha256: string;
  pdfFilename: string; // the file's name when the project was created
  createdAt: string; // ISO 8601, UTC
  lastModifiedAt: string; // any change to the project's own data, a rename included
  lastOpenedAt: string;
};

type ProjectRow = {
  id: string;
  name: string;
  pdf_sha256: string;
  pdf_filename: string;
  created_at: string;
  last_modified_at: string;
  last_opened_at: string;
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
  };
}

function isNameConflict(err: unknown): boolean {
  return String(err).includes("UNIQUE constraint failed: projects.name");
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => "\\" + ch);
}

async function getProject(db: D1Database, id: string): Promise<Project | null> {
  const row = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<ProjectRow>();
  return row && toProject(row);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// All projects, most recently opened first.
app.get("/api/projects", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects ORDER BY last_opened_at DESC, created_at DESC",
  ).all<ProjectRow>();
  return c.json(results.map(toProject));
});

// Stores the PDF in R2 and creates a project on it. A PDF that is already known gets another project.
app.post("/api/projects", async (c) => {
  const form = await c.req.formData();
  const pdf = form.get("pdf");
  const sha256 = form.get("sha256");
  if (!(pdf instanceof File) || typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) {
    return c.json({ error: "expected a 'pdf' file and its 'sha256' in lowercase hex" }, 400);
  }

  // R2 checks the bytes against the hash and refuses the upload if they differ.
  await c.env.PDFS.put(`pdfs/${sha256}.pdf`, await pdf.arrayBuffer(), { sha256 });

  const now = new Date().toISOString();
  const base = defaultName(pdf.name);
  // Another project may take the chosen name between the lookup and the insert: then look again.
  for (let attempt = 0; ; attempt++) {
    const { results } = await c.env.DB.prepare("SELECT name FROM projects WHERE name = ? OR name LIKE ? ESCAPE '\\'")
      .bind(base, `${escapeLike(base)} (%)`)
      .all<{ name: string }>();
    const project: Project = {
      id: crypto.randomUUID(),
      name: firstFreeName(
        base,
        results.map((row) => row.name),
      ),
      pdfSha256: sha256,
      pdfFilename: pdf.name,
      createdAt: now,
      lastModifiedAt: now,
      lastOpenedAt: now,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          project.id,
          project.name,
          project.pdfSha256,
          project.pdfFilename,
          project.createdAt,
          project.lastModifiedAt,
          project.lastOpenedAt,
        )
        .run();
      return c.json(project, 201);
    } catch (err) {
      if (!isNameConflict(err) || attempt >= 4) throw err;
    }
  }
});

// Renames a project. A name that is already taken is refused, not numbered.
app.patch("/api/projects/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return c.json({ error: `expected a 'name' of 1 to ${MAX_NAME_LENGTH} characters` }, 400);
  }
  try {
    const result = await c.env.DB.prepare("UPDATE projects SET name = ?, last_modified_at = ? WHERE id = ?")
      .bind(name, new Date().toISOString(), c.req.param("id"))
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
  const result = await c.env.DB.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return c.json({ error: "no such project" }, 404);
  return c.body(null, 204);
});

export default app;
