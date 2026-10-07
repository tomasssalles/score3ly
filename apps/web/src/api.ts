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

export type PdfLookup = {
  projects: Project[]; // most recently opened first
  newProjectName: string; // the name a new project would get
};

// What the Worker knows about a PDF, before uploading it.
export async function lookUpPdf(sha256: string, filename: string): Promise<PdfLookup> {
  const query = new URLSearchParams({ filename });
  return (await checked(await fetch(`/api/pdfs/${sha256}?${query}`))).json();
}

// Creates a project on a PDF. The file is uploaded unless the Worker already has it.
export async function createProject(pdf: File, sha256: string, alreadyStored: boolean): Promise<Project> {
  const form = new FormData();
  if (alreadyStored) {
    form.append("filename", pdf.name);
  } else {
    form.append("pdf", pdf);
  }
  form.append("sha256", sha256);
  return (await checked(await fetch("/api/projects", { method: "POST", body: form }))).json();
}

export async function markOpened(project: Project): Promise<void> {
  await checked(await fetch(`/api/projects/${project.id}/opened`, { method: "POST" }));
}
