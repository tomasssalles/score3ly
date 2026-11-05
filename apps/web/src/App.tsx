import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { leavesProject, runningProject } from "./leaveGuard";
import { ApiError, createProject, listProjects, lookUpPdf, markOpened, renameProject, type PdfLookup, type Project } from "./api";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { Header } from "./Header";
import { useEditionWindow, useHost } from "./host";
import { KnownPdfDialog } from "./KnownPdfDialog";
import { ProjectPicker } from "./ProjectPicker";
import { ProjectView } from "./ProjectView";
import { PageView } from "./PageView";
import { RenameDialog } from "./RenameDialog";
import { hashForArtifact, hashForProject, hashForStage, pageFromHash, parseRoute } from "./route";
import { sha256Hex } from "@score3ly/core";
import { useHash } from "./useHash";

export function App() {
  // Most recently opened first. null until loaded.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A picked PDF that already has projects, waiting for the user's choice.
  const [knownPdf, setKnownPdf] = useState<{ pdf: File; sha256: string; lookup: PdfLookup } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The name of the project just deleted: said where the project was, until something else is opened.
  const [deleted, setDeleted] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // In the desktop app everything is on this computer: there is no remote storage to speak of (docs/desktop.md).
  const desktop = useHost() === "desktop";
  useEditionWindow();
  // Leaving a project while this device runs one of its stages asks first (docs/project-view.md): the URL it was
  // going to, and what to do once it is there.
  const [leaving, setLeaving] = useState<{ hash: string; then: () => void } | null>(null);
  const holds = (next: string) => {
    const running = runningProject();
    return running !== null && leavesProject(next, running);
  };
  // The open project, and the artifact the user picked, are the ones in the URL, if any. A change that leaves a
  // running project (a link, the back button) is held until the user confirms.
  const { hash, go } = useHash((next, proceed) => {
    if (!holds(next)) return false;
    setLeaving({ hash: next, then: proceed });
    return true;
  });
  // Goes to a URL from within the app, asking first if that leaves a running project.
  const navigate = (next: string, then?: () => void) => {
    const goThere = () => {
      go(next);
      then?.();
    };
    if (holds(next)) return setLeaving({ hash: next, then: goThere });
    goThere();
  };
  const route = parseRoute(hash);
  // A page from the menu, if one is open instead of a project.
  const page = pageFromHash(hash);
  const current = projects?.find((project) => project.id === route?.projectId) ?? null;
  // Whether the open artifact (or stage's details) was opened from within the app, so closing it can go back in
  // history.
  const openedArtifactHere = useRef(false);
  if (route?.artifactId == null && route?.stageId == null) openedArtifactHere.current = false;

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

  // Opening anything else ends the message about a deleted project.
  useEffect(() => {
    if (route || page) setDeleted(null);
  }, [hash]);

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
      navigate(hashForProject(created.id));
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

  function showStage(stageId: string) {
    if (!current) return;
    openedArtifactHere.current = true;
    window.location.hash = hashForStage(current.id, stageId);
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

  function open(project: Project) {
    setError(null);
    // Marked as opened only once it is: not if the user stays in a running project.
    navigate(hashForProject(project.id), async () => {
      try {
        await markOpened(project);
      } catch (err) {
        setError(`Opening the project failed: ${err}`);
        return;
      }
      await refresh();
    });
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
        {renaming && current && (
          <RenameDialog
            title="Rename project"
            current={current.name}
            save={async (name) => {
              try {
                await renameProject(current, name);
              } catch (err) {
                throw new Error(
                  err instanceof ApiError && err.status === 409
                    ? "A project with that name already exists. Names must be unique (case-insensitive)."
                    : `Renaming failed: ${err}`,
                );
              }
            }}
            onDone={() => {
              setRenaming(false);
              refresh();
            }}
            onCancel={() => setRenaming(false)}
          />
        )}
        {deleting && current && (
          <DeleteProjectDialog
            project={current}
            onDeleted={() => {
              setDeleting(false);
              setDeleted(current.name);
              // The project's URL leads nowhere now: replaced, so that going back doesn't land on it.
              window.location.replace("#/");
              refresh();
            }}
            onCancel={() => setDeleting(false)}
          />
        )}
        {leaving && (
          <ConfirmDialog
            title="Leave the project?"
            text={[
              "A stage is running. Leaving the project stops it. What is done so far is kept, and Run picks up from there; an answer from a model still on its way is lost, although it is paid for.",
            ]}
            confirmLabel="Leave"
            onConfirm={() => {
              const { then } = leaving;
              setLeaving(null);
              then();
            }}
            onCancel={() => setLeaving(null)}
          />
        )}
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
            stageId={route?.stageId ?? null}
            onSelectArtifact={selectArtifact}
            onShowStage={showStage}
            onCloseArtifact={closeArtifact}
            onRename={() => setRenaming(true)}
            onDelete={() => setDeleting(true)}
            onChanged={refresh}
          />
        ) : (
          projects !== null && (
            <div className="empty-state">
              {deleted !== null ? (
                <p>{desktop ? `"${deleted}" was deleted.` : `"${deleted}" was deleted from this device and from the remote storage.`}</p>
              ) : route ? (
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
