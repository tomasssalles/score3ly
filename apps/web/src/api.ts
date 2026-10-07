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

async function checked(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response;
}

// All projects, most recently opened first.
export async function listProjects(): Promise<Project[]> {
  return (await checked(await fetch("/api/projects"))).json();
}

// Uploads the PDF and creates a project on it.
export async function createProject(pdf: File): Promise<Project> {
  const form = new FormData();
  form.append("pdf", pdf);
  form.append("sha256", await sha256Hex(await pdf.arrayBuffer()));
  return (await checked(await fetch("/api/projects", { method: "POST", body: form }))).json();
}

export async function markOpened(project: Project): Promise<void> {
  await checked(await fetch(`/api/projects/${project.id}/opened`, { method: "POST" }));
}
