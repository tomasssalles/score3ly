import { useEffect, useRef, useState } from "react";
import { ApiError, renameProject, type Project } from "./api";
import { CloseIcon } from "./icons";
import { MAX_NAME_LENGTH, nameProblem } from "./names";

// Renames a project. The name must stay unique (ignoring case); the Worker refuses a taken one.
export function RenameDialog({
  project,
  onRenamed,
  onCancel,
}: {
  project: Project;
  onRenamed: (project: Project) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    input.current?.select();
  }, []);

  const problem = nameProblem(name, project.name);
  // An empty or unchanged name only disables saving; the other problems are worth saying.
  const shownProblem = problem !== null && name.trim() !== "" && name.trim() !== project.name ? problem : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem !== null || saving) return;
    setSaving(true);
    setError(null);
    try {
      onRenamed(await renameProject(project, name.trim()));
      // Closing (rather than just disappearing) puts the focus back where it was, on the actions button.
      dialog.current?.close();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? `Another project is already called "${name.trim()}". Names are compared ignoring case.`
          : `Renaming failed: ${err}`,
      );
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby="rename-title"
      // Esc closes the dialog.
      onClose={onCancel}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={save}>
        <div className="dialog-head">
          <h2 id="rename-title">Rename project</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        <label className="field">
          <span>Name</span>
          <input
            ref={input}
            id="rename-name"
            type="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_NAME_LENGTH + 50}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={shownProblem !== null || error !== null}
            aria-describedby="rename-message"
          />
        </label>
        <p id="rename-message" className="field-message" role="alert">
          {error ?? shownProblem}
        </p>
        <div className="dialog-buttons">
          <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={problem !== null || saving}>
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
