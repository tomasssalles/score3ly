import { useEffect, useRef, useState } from "react";
import { createProject, listProjects, lookUpPdf, markOpened, type PdfLookup, type Project } from "./api";
import { Header } from "./Header";
import { KnownPdfDialog } from "./KnownPdfDialog";
import { ProjectPicker } from "./ProjectPicker";
import { ProjectView } from "./ProjectView";
import { PageView } from "./PageView";
import { hashForArtifact, hashForProject, pageFromHash, parseRoute } from "./route";
import { sha256Hex } from "./sha256";
import { useHash } from "./useHash";

export function App() {
  // Most recently opened first. null until loaded.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A picked PDF that already has projects, waiting for the user's choice.
  const [knownPdf, setKnownPdf] = useState<{ pdf: File; sha256: string; lookup: PdfLookup } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The open project, and the artifact the user picked, are the ones in the URL, if any.
  const hash = useHash();
  const route = parseRoute(hash);
  // A page from the menu, if one is open instead of a project.
  const page = pageFromHash(hash);
  const current = projects?.find((project) => project.id === route?.projectId) ?? null;
  // Whether the open artifact was opened from within the app, so closing it can go back in history.
  const openedArtifactHere = useRef(false);
  if (route?.artifactId == null) openedArtifactHere.current = false;

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

  function selectArtifact(artifactId: string) {
    if (!current) return;
    openedArtifactHere.current = true;
    window.location.hash = hashForArtifact(current.id, artifactId);
  }

  // Back to the project. Going back in history means the browser's back button won't reopen the artifact.
  function closeArtifact() {
    if (!current) return;
    if (openedArtifactHere.current) {
      openedArtifactHere.current = false;
      history.back();
    } else {
      window.location.replace(hashForProject(current.id));
    }
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
        picker={<ProjectPicker projects={projects ?? []} current={current} onPick={open} />}
        page={page}
        onNewProject={() => fileInput.current?.click()}
      />
      <main className="app-main">
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
        {error && <p className="error-banner">{error}</p>}
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
        {page ? (
          <PageView page={page} />
        ) : current ? (
          <ProjectView
            key={current.id}
            project={current}
            artifactId={route?.artifactId ?? null}
            onSelectArtifact={selectArtifact}
            onCloseArtifact={closeArtifact}
          />
        ) : (
          projects !== null && (
            <div className="empty-state">
              {route ? (
                <p>This project doesn't exist (any more).</p>
              ) : (
                <p>Pick a project above, or start one with "+ New project".</p>
              )}
            </div>
          )
        )}
      </main>
    </>
  );
}
