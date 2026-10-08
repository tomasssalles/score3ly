import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";

// Asks before doing something that can't be undone.
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string[];
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby="confirm-title"
      // Esc, the backdrop, Cancel and the confirm button all end up here.
      onClose={() => (confirmed.current ? onConfirm() : onCancel())}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="dialog-head">
        <h2 id="confirm-title">{title}</h2>
        <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
          <CloseIcon />
        </button>
      </div>
      {text.map((paragraph) => (
        <p key={paragraph} className="dialog-text">
          {paragraph}
        </p>
      ))}
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? "button-danger" : "button-primary"}
          onClick={() => {
            confirmed.current = true;
            dialog.current?.close();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
