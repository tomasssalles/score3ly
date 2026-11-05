import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { MAX_NAME_LENGTH, nameProblem } from "./names";

// Renames something whose name must stay unique, ignoring case (a project, a model config): `save` is the request, and
// its refusal (a taken name) is shown in the dialog, which stays open (docs/style.md, "Dialogs").
export function RenameDialog({
  title,
  current,
  save,
  onDone,
  onCancel,
}: {
  title: string;
  current: string;
  save: (name: string) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    input.current?.select();
  }, []);

  const problem = nameProblem(name, current);
  // An empty or unchanged name only disables saving; the other problems are worth saying.
  const shownProblem = problem !== null && name.trim() !== "" && name.trim() !== current ? problem : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem !== null || saving) return;
    setSaving(true);
    setError(null);
    try {
      await save(name.trim());
      onDone();
      // Closing (rather than just disappearing) puts the focus back where it was, on the actions button.
      dialog.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="rename-title">{title}</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        <label className="field">
          <input
            ref={input}
            id="rename-name"
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-label="New name"
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
