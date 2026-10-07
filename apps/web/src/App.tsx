import { useEffect, useRef, useState } from "react";
import { createProject, listProjects, lookUpPdf, markOpened, type PdfLookup, type Project } from "./api";
import { Header } from "./Header";
import { KnownPdfDialog } from "./KnownPdfDialog";
import { ProjectPicker } from "./ProjectPicker";
import { hashForProject, projectIdFromHash } from "./route";
import { sha256Hex } from "./sha256";
import { useHash } from "./useHash";

export function App() {
  const [health, setHealth] = useState("checking...");
  // Most recently opened first.
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  // A picked PDF that already has projects, waiting for the user's choice.
  const [knownPdf, setKnownPdf] = useState<{ pdf: File; sha256: string; lookup: PdfLookup } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The open project is the one in the URL, if any.
  const currentId = projectIdFromHash(useHash());
  const current = projects.find((project) => project.id === currentId) ?? null;

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { status: string }) => setHealth(body.status))
      .catch((err) => setHealth(`error: ${err}`));
  }, []);

  async function refresh() {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(`Loading the projects failed: ${err}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // A picked PDF gets a new project, unless it already has projects: then the user chooses.
  async function pdfPicked(pdf: File) {
    setError(null);
    let sha256: string;
    let lookup: PdfLookup;
    try {
      sha256 = await sha256Hex(await pdf.arrayBuffer());
      lookup = await lookUpPdf(sha256, pdf.name);
    } catch (err) {
      setError(`Checking the PDF failed: ${err}`);
      return;
    }
    if (lookup.projects.length > 0) {
      setKnownPdf({ pdf, sha256, lookup });
    } else {
      await newProject(pdf, sha256, false);
    }
  }

  async function newProject(pdf: File, sha256: string, alreadyStored: boolean) {
    setError(null);
    try {
      const created = await createProject(pdf, sha256, alreadyStored);
      window.location.hash = hashForProject(created.id);
    } catch (err) {
      setError(`Creating the project failed: ${err}`);
      return;
    }
    await refresh();
  }

  async function open(project: Project) {
    setError(null);
    window.location.hash = hashForProject(project.id);
    try {
      await markOpened(project);
    } catch (err) {
      setError(`Opening the project failed: ${err}`);
      return;
    }
    await refresh();
  }

  return (
    <>
      <Header
        picker={<ProjectPicker projects={projects} current={current} onPick={open} />}
        onNewProject={() => fileInput.current?.click()}
      />
      <main className="content">
        <p>API: {health}</p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const pdf = e.target.files?.[0];
            if (pdf) pdfPicked(pdf);
            // Lets the same file be picked again.
            e.target.value = "";
          }}
        />
        {error && <p>{error}</p>}
        {knownPdf && (
          <KnownPdfDialog
            filename={knownPdf.pdf.name}
            projects={knownPdf.lookup.projects}
            newProjectName={knownPdf.lookup.newProjectName}
            onOpen={(project) => {
              setKnownPdf(null);
              open(project);
            }}
            onCreate={() => {
              setKnownPdf(null);
              newProject(knownPdf.pdf, knownPdf.sha256, true);
            }}
            onCancel={() => setKnownPdf(null)}
          />
        )}
        {current && (
          <p className="detail">
            Project "{current.name}"
            <br />
            ID: {current.id}
            <br />
            PDF: {current.pdfFilename}
            <br />
            SHA-256: {current.pdfSha256}
            <br />
            Created: {current.createdAt}
          </p>
        )}
      </main>
    </>
  );
}
