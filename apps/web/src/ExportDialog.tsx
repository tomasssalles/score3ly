import { useEffect, useRef, useState } from "react";
import { ApiError, type Project } from "./api";
import { saveFile } from "./engraving";
import { FittedText } from "./FittedText";
import { useHost } from "./host";
import { CloseIcon } from "./icons";
import { ProgressBar } from "./ProgressBar";
import { exportName, exportProject } from "./projectFile";

// Exports a project as one file (docs/database.md, "Exporting and importing a project"), after saying what it holds.
export function ExportDialog({ project, onDone }: { project: Project; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = useHost() === "desktop";
  const name = exportName(project.name);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (progress !== null) return;
    setProgress(0);
    setError(null);
    try {
      saveFile(await exportProject(project, setProgress), name);
      dialog.current?.close();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? `A stage of this project is running${desktop ? "" : ", here or on another device"}. Stop it, or let it finish, then export the project.`
          : `Exporting failed: ${err}`,
      );
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <dialog
      ref={dialog}
      className="app-dialog export-dialog"
      aria-labelledby="export-title"
      onClose={onDone}
      onClick={(e) => e.target === dialog.current && !busy && dialog.current.close()}
    >
      <form onSubmit={confirm}>
        <div className="dialog-head">
          <h2 id="export-title">Export project</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" disabled={busy} onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        <p className="dialog-file">
          <FittedText text={name} lines={3} />
        </p>
        <p className="dialog-text">
          Saves the project as a zipped archive: its pipeline as it is now, with the PDF, the results and the models' answers.
          The file can be imported back into any score3ly instance with "+ New project".
        </p>
        <p className="dialog-text">Earlier attempts stay out: stages that were replaced or dropped, and their answers.</p>
        {busy && <ProgressBar value={progress} label="Exporting" />}
        <p className="field-message error-text" role="alert">
          {error}
        </p>
        <div className="dialog-buttons">
          <button type="button" className="button-secondary" disabled={busy} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
