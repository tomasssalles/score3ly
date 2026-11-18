import { useState } from "react";
import { failure, ApiError, deleteProject, type Project } from "./api";
import { FittedText } from "./FittedText";
import { useHost } from "./host";
import { deleteCachedPdf } from "./imageCache";
import { closePdfForImages } from "./pageImages";
import { Dialog, useDialog } from "./ui/Dialog";

// Deletes a project (docs/database.md, "Deleting a project"), once its name is typed exactly (case included; pasting doesn't count).
export function DeleteProjectDialog({
  project,
  onDeleted,
  onCancel,
}: {
  project: Project;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const dialog = useDialog<"deleted">();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The desktop app is the only device its data is on.
  const desktop = useHost() === "desktop";

  const matches = typed === project.name;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const { pdfUnused } = await deleteProject(project);
      // The images made from its PDF on this device, unless another project still uses the PDF.
      if (pdfUnused) {
        closePdfForImages(project.pdfSha256);
        await deleteCachedPdf(project.pdfSha256);
      }
      dialog.close("deleted");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "running"
          ? `A stage of this project is running${desktop ? "" : ", here or on another device"}. Stop it, or let it finish, then delete the project.`
          : failure("Deleting failed", err),
      );
      setDeleting(false);
    }
  }

  const refuse = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <Dialog
      handle={dialog}
      title="Delete project"
      className="delete-dialog"
      busy={deleting}
      onSubmit={confirm}
      onClose={(result) => (result === "deleted" ? onDeleted() : onCancel())}
    >
      <p className="dialog-file delete-name">
        <FittedText text={project.name} lines={3} />
      </p>
      <p className="dialog-text">
        The project and all its files will be deleted, along with any data cached on this device (with the exception of
        files still in use by other projects). Only its costs will still be reported in the Statistics page. This action
        cannot be undone.
      </p>
      <label className="field delete-field">
        <span className="dialog-text">Type the project's name to confirm:</span>
        <input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          onPaste={refuse}
          onDrop={refuse}
          aria-describedby="delete-message"
        />
      </label>
      <p id="delete-message" className="field-message error-text" role="alert">
        {error}
      </p>
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" disabled={deleting} onClick={() => dialog.close()}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!matches || deleting}>
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </div>
    </Dialog>
  );
}
