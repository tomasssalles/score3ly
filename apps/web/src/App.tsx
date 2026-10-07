import { useEffect, useRef, useState } from "react";
import { createProject, listProjects, markOpened, type Project } from "./api";
import { Header } from "./Header";
import { ProjectPicker } from "./ProjectPicker";

export function App() {
  const [health, setHealth] = useState("checking...");
  // Most recently opened first; the first one is the current project.
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = projects[0] ?? null;

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

  async function newProject(pdf: File) {
    setError(null);
    try {
      await createProject(pdf);
    } catch (err) {
      setError(`Creating the project failed: ${err}`);
      return;
    }
    await refresh();
  }

  async function open(project: Project) {
    setError(null);
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
            if (pdf) newProject(pdf);
            // Lets the same file be picked again.
            e.target.value = "";
          }}
        />
        {error && <p>{error}</p>}
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
