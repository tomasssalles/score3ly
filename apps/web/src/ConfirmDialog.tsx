import { Dialog, useDialog } from "./ui/Dialog";

// Asks before doing something that can't be undone.
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  danger?: boolean; // the action destroys something: its button is red (docs/style.md, "Dialogs")
  title: string;
  text: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useDialog<"confirmed">();

  return (
    // Esc, the backdrop, Cancel and the confirm button all end up in `onClose`.
    <Dialog handle={dialog} title={title} onClose={(result) => (result === "confirmed" ? onConfirm() : onCancel())}>
      {text.map((paragraph) => (
        <p key={paragraph} className="dialog-text">
          {paragraph}
        </p>
      ))}
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" onClick={() => dialog.close()}>
          Cancel
        </button>
        <button type="button" className={danger ? "button-danger" : "button-primary"} onClick={() => dialog.close("confirmed")}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
