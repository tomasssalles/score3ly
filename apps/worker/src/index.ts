import { Hono } from "hono";

export type Project = {
  id: string;
  pdfSha256: string;
  pdfFilename: string; // the file's name when the project was created
  createdAt: string; // ISO 8601, UTC
};

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

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

  const project: Project = {
    id: crypto.randomUUID(),
    pdfSha256: sha256,
    pdfFilename: pdf.name,
    createdAt: new Date().toISOString(),
  };
  await c.env.DB.prepare("INSERT INTO projects (id, pdf_sha256, pdf_filename, created_at) VALUES (?, ?, ?, ?)")
    .bind(project.id, project.pdfSha256, project.pdfFilename, project.createdAt)
    .run();
  return c.json(project, 201);
});

export default app;
