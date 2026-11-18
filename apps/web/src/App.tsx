import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { failure, ApiError, createProject, listProjects, lookUpPdf, markOpened, renameProject, STALE_EVENT, type ListedProject, type PdfLookup, type Project } from "./api";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ExportDialog } from "./ExportDialog";
import { EXTENSION, importArchive, type ProjectArchive, unzipArchive } from "./projectFile";
import { Header } from "./Header";
import { Home } from "./Home";
import { useEditionWindow, useHost } from "./host";
import { KnownPdfDialog } from "./KnownPdfDialog";
import { ProjectPicker } from "./ProjectPicker";
import { ProjectView } from "./ProjectView";
import { PageView } from "./PageView";
import { RenameDialog } from "./RenameDialog";
import { HOME_HASH, hashForArtifact, hashForProject, hashForStage, pageFromHash, parseRoute } from "./route";
import { errorText, LEAVING_A_RUN, sha256Hex } from "@score3ly/core";
import { useAppNavigation } from "./navigation";
import { makeAndOpen } from "./newProjectFlow";
import { discardUnsaved, hasUnsaved } from "./saving";

export function App() {
  // Most recently opened first. null until loaded.
  const [projects, setProjects] = useState<ListedProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A picked PDF that already has projects, waiting for the user's choice.
  const [knownPdf, setKnownPdf] = useState<{ pdf: File; sha256: string; lookup: PdfLookup } | null>(null);
  // A picked project file (docs/database.md, "Exporting and importing a project") whose PDF already has projects.
  const [knownArchive, setKnownArchive] = useState<{ file: File; archive: ProjectArchive; lookup: PdfLookup } | null>(null);
  // An import on its way: its project's name.
  const [importing, setImporting] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The name of the project just deleted: said where the project was, until something else is opened.
  const [deleted, setDeleted] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // In the desktop app everything is on this computer: there is no remote storage to speak of (docs/desktop.md).
  const desktop = useHost() === "desktop";
  useEditionWindow();
  // The open project, and the artifact the user picked, are the ones in the URL, if any. A change that leaves a
  // running project (a link, the back button) waits until the user confirms.
  const { hash, navigate, go, replace, whenLeaving, openDetail, closeDetail, leaving, leavingStopsRun, stay } = useAppNavigation();
  const route = parseRoute(hash);
  // A page from the menu, if one is open instead of a project.
  const page = pageFromHash(hash);
  const current = projects?.find((project) => project.id === route?.projectId) ?? null;

  async function refresh() {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(failure("Loading the projects failed", err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // A change refused because the project changed on another device or in another tab (optimistic locking,
  // docs/database.md): the page offers to reload, which shows the project as it is now.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const show = () => setStale(true);
    window.addEventListener(STALE_EVENT, show);
    return () => window.removeEventListener(STALE_EVENT, show);
  }, []);

  // Opening anything else ends the message about a deleted project.
  useEffect(() => {
    if (route || page) setDeleted(null);
  }, [hash]);

  // A URL naming a project the list doesn't have (made on another device since the list was loaded, a link pasted
  // in) loads the list again once, before the app says the project doesn't exist.
  const [listCheckedFor, setListCheckedFor] = useState<string | null>(null);
  const missing = route !== null && projects !== null && current === null ? route.projectId : null;
  useEffect(() => {
    if (missing !== null && listCheckedFor !== missing) refresh().then(() => setListCheckedFor(missing));
  }, [missing]);

  // The home (no project and no page open) loads the projects again whenever it is shown, so that its cards say where
  // each pipeline is now (docs/project-view.md, "The home"). The first load is the one above.
  const home = !route && !page;
  useEffect(() => {
    if (home && projects !== null) refresh();
  }, [home]);

  // A picked PDF gets a new project, unless it already has projects: then the user chooses. A project file is imported,
  // the same way.
  async function pdfPicked(pdf: File) {
    setError(null);
    if (pdf.name.toLowerCase().endsWith(EXTENSION)) return archivePicked(pdf);
    let sha256: string;
    let lookup: PdfLookup;
    try {
      sha256 = await sha256Hex(await pdf.arrayBuffer());
      lookup = await lookUpPdf(sha256, pdf.name);
    } catch (err) {
      setError(failure("Checking the PDF failed", err));
      return;
    }
    if (lookup.projects.length > 0) {
      setKnownPdf({ pdf, sha256, lookup });
    } else {
      newProject(pdf, sha256, false);
    }
  }

  async function archivePicked(file: File) {
    let archive: ProjectArchive;
    let lookup: PdfLookup;
    try {
      archive = await unzipArchive(new Uint8Array(await file.arrayBuffer()));
      // The name a new project would get: the exported one, numbered if taken.
      lookup = await lookUpPdf(archive.rows.project.pdf_sha256, `${archive.rows.project.name}.pdf`);
    } catch (err) {
      setError(failure("Importing the project failed", err));
      return;
    }
    if (lookup.projects.length > 0) {
      setKnownArchive({ file, archive, lookup });
    } else {
      importProject(archive, lookup.newProjectName);
    }
  }

  function importProject(archive: ProjectArchive, name: string) {
    setError(null);
    makeAndOpen({
      whenLeaving,
      make: async () => {
        setImporting(name);
        try {
          return await importArchive(archive);
        } finally {
          setImporting(null);
        }
      },
      refresh,
      open: (imported) => go(hashForProject(imported.id)),
      failed: async (err) => {
        setError(failure("Importing the project failed", err));
        await refresh();
      },
    });
  }

  function newProject(pdf: File, sha256: string, alreadyStored: boolean) {
    setError(null);
    makeAndOpen({
      whenLeaving,
      make: () => createProject(pdf, sha256, alreadyStored),
      refresh,
      open: (created) => go(hashForProject(created.id)),
      failed: (err) => setError(failure("Creating the project failed", err)),
    });
  }

  function selectArtifact(artifactId: string) {
    if (current) openDetail(hashForArtifact(current.id, artifactId));
  }

  function showStage(stageId: string) {
    if (current) openDetail(hashForStage(current.id, stageId));
  }

  // Back to the project. Going back in history means the browser's back button won't reopen the artifact.
  function closeArtifact() {
    if (current) closeDetail(hashForProject(current.id));
  }

  function open(project: Project) {
    setError(null);
    // Marked as opened only once it is: not if the user stays in a running project.
    navigate(hashForProject(project.id), async () => {
      try {
        await markOpened(project);
      } catch (err) {
        setError(failure("Opening the project failed", err));
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
          accept={`application/pdf,.pdf,${EXTENSION}`}
          hidden
          onChange={(e) => {
            const pdf = e.target.files?.[0];
            if (pdf) pdfPicked(pdf);
            // Lets the same file be picked again.
            e.target.value = "";
          }}
        />
        {error && <p className="error-banner error-text">{error}</p>}
        {importing !== null && <p className="status-banner" role="status">Importing "{importing}"…</p>}
        {renaming && current && (
          <RenameDialog
            title="Rename project"
            current={current.name}
            save={async (name) => {
              try {
                await renameProject(current, name);
              } catch (err) {
                throw new Error(
                  err instanceof ApiError && err.stale
                    ? "The project was changed elsewhere: reload first."
                    : err instanceof ApiError && err.code === "name_taken"
                    ? err.message
                    : `Renaming failed: ${errorText(err)}`,
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
        {exporting && current && <ExportDialog project={current} onDone={() => setExporting(false)} />}
        {deleting && current && (
          <DeleteProjectDialog
            project={current}
            onDeleted={() => {
              setDeleting(false);
              setDeleted(current.name);
              // The project's URL leads nowhere now: replaced, so that going back doesn't land on it.
              replace(HOME_HASH);
              refresh();
            }}
            onCancel={() => setDeleting(false)}
          />
        )}
        {stale && (
          <ConfirmDialog
            title="Changed elsewhere"
            text={[
              "This project was changed on another device or in another tab since this page loaded it, so your last change wasn't made. Reload to see the project as it is now, then make the change again.",
            ]}
            confirmLabel="Reload"
            onConfirm={() => window.location.reload()}
            onCancel={() => setStale(false)}
          />
        )}
        {leaving && (
          <LeaveDialog
            stopsRun={leavingStopsRun}
            onConfirm={() => {
              discardUnsaved();
              leaving();
            }}
            onCancel={stay}
          />
        )}
        {knownArchive && (
          <KnownPdfDialog
            filename={knownArchive.file.name}
            projects={knownArchive.lookup.projects}
            newLabel="→ Import as a new project"
            newProjectName={knownArchive.lookup.newProjectName}
            onOpen={(project) => {
              setKnownArchive(null);
              open(project);
            }}
            onCreate={() => {
              setKnownArchive(null);
              importProject(knownArchive.archive, knownArchive.lookup.newProjectName);
            }}
            onCancel={() => setKnownArchive(null)}
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
          <PageView page={page} hash={hash} replace={replace} />
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
            onExport={() => setExporting(true)}
            onDelete={() => setDeleting(true)}
            onChanged={refresh}
          />
        ) : route ? (
          listCheckedFor === route.projectId && (
            <div className="empty-state">
              <p>This project doesn't exist (any more).</p>
            </div>
          )
        ) : (
          projects !== null && (
            <Home
              projects={projects}
              notice={
                deleted !== null && (
                  <p className="home-notice">
                    {desktop ? `"${deleted}" was deleted.` : `"${deleted}" was deleted from this device and from the remote storage.`}
                  </p>
                )
              }
              onOpen={open}
            />
          )
        )}
      </main>
    </>
  );
}

// The question before leaving (navigation.ts): a run this device would stop, edits that couldn't be saved, or both.
function LeaveDialog({ stopsRun: running, onConfirm, onCancel }: { stopsRun: boolean; onConfirm: () => void; onCancel: () => void }) {
  const unsaved = hasUnsaved();
  return (
    <ConfirmDialog
      title={running ? "Leave the project?" : "Leave the editor?"}
      text={[
        ...(running ? [`A stage is running. Leaving the project stops it. ${LEAVING_A_RUN}`] : []),
        ...(unsaved ? ["Some of your edits couldn't be saved. Leaving discards them."] : []),
      ]}
      confirmLabel="Leave"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
