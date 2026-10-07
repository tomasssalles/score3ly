import { sha256Hex } from "./sha256";

// Mirrors the Worker's Project type (apps/worker/src/index.ts).
export type Project = {
  id: string;
  name: string;
  pdfSha256: string;
  pdfFilename: string;
  createdAt: string;
  lastModifiedAt: string;
  lastOpenedAt: string;
};

// Uploads the PDF and creates a project on it.
export async function createProject(pdf: File): Promise<Project> {
  const form = new FormData();
  form.append("pdf", pdf);
  form.append("sha256", await sha256Hex(await pdf.arrayBuffer()));
  const response = await fetch("/api/projects", { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
