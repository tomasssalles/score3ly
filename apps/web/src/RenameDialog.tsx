import { useEffect, useRef, useState } from "react";
import { MAX_NAME_LENGTH, nameProblem } from "./names";
import { Dialog, useDialog } from "./ui/Dialog";

// Renames something whose name must stay unique, ignoring case (a project, a model config): `save` is the request, and
// its refusal (a taken name) is shown in the dialog, which stays open (docs/style.md, "Dialogs"). `onDone` once renamed,
// `onCancel` when closed without renaming.
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
  const dialog = useDialog<"renamed">();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      dialog.close("renamed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Dialog handle={dialog} title={title} busy={saving} onSubmit={submit} onClose={(result) => (result === "renamed" ? onDone() : onCancel())}>
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
      <p id="rename-message" className="field-message error-text" role="alert">
        {error ?? shownProblem}
      </p>
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" disabled={saving} onClick={() => dialog.close()}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={problem !== null || saving}>
          {saving ? "Saving…" : "Rename"}
        </button>
      </div>
    </Dialog>
  );
}
