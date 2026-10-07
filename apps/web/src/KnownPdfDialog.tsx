import { useEffect, useRef } from "react";
import type { Project } from "./api";
import { ago } from "./time";

// Shown when a picked PDF already has projects: open one of them, or create another.
export function KnownPdfDialog({
  filename,
  projects,
  newProjectName,
  onOpen,
  onCreate,
  onCancel,
}: {
  filename: string;
  projects: Project[]; // most recently opened first
  newProjectName: string;
  onOpen: (project: Project) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="known-pdf"
      aria-labelledby="known-pdf-title"
      // Esc closes the dialog.
      onClose={onCancel}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="dialog-head">
        <h2 id="known-pdf-title">Projects already based on this file</h2>
        <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <p className="dialog-file">{filename}</p>
      <ul className="dialog-list">
        {projects.map((project) => (
          <li key={project.id}>
            <button type="button" onClick={() => onOpen(project)}>
              <span className="option-name">{project.name}</span>
              <span className="option-time">{ago(project.lastOpenedAt)}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="dialog-new" onClick={onCreate}>
            <span className="option-name">+ New project</span>
            <span className="option-name new-name">{newProjectName}</span>
          </button>
        </li>
      </ul>
    </dialog>
  );
}
