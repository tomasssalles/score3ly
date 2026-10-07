import { useEffect, useRef, useState } from "react";
import { createProject, type Project } from "./api";
import { Header } from "./Header";

export function App() {
  const [health, setHealth] = useState("checking...");
  const [created, setCreated] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { status: string }) => setHealth(body.status))
      .catch((err) => setHealth(`error: ${err}`));
  }, []);

  async function newProject(pdf: File) {
    setError(null);
    try {
      setCreated(await createProject(pdf));
    } catch (err) {
      setError(`Creating the project failed: ${err}`);
    }
  }

  return (
    <>
      <Header onNewProject={() => fileInput.current?.click()} />
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
        {created && (
          <p className="detail">
            Created project "{created.name}"
            <br />
            ID: {created.id}
            <br />
            PDF: {created.pdfFilename}
            <br />
            SHA-256: {created.pdfSha256}
            <br />
            Created: {created.createdAt}
          </p>
        )}
      </main>
    </>
  );
}
