import type { Project } from "./api";
import { FittedText } from "./FittedText";
import { when } from "./format";
import { Dialog, useDialog } from "./ui/Dialog";

// Shown when a picked PDF, or the PDF of a picked project file, already has projects: open one of them, or create
// (import) another.
export function KnownPdfDialog({
  filename,
  projects,
  newProjectName,
  newLabel = "+ New project",
  onOpen,
  onCreate,
  onCancel,
}: {
  filename: string;
  projects: Project[]; // most recently opened first
  newProjectName: string;
  newLabel?: string;
  onOpen: (project: Project) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const dialog = useDialog();

  return (
    <Dialog
      handle={dialog}
      title="Projects already based on this file"
      className="known-pdf"
      // Opening a project or creating one unmounts the dialog: only Esc, × and the backdrop end up here.
      onClose={onCancel}
    >
      <p className="dialog-file">
        <FittedText text={filename} lines={3} />
      </p>
      <ul className="dialog-list">
        {projects.map((project) => (
          <li key={project.id}>
            <button type="button" onClick={() => onOpen(project)}>
              <FittedText className="option-name" text={project.name} lines={3} />
              <span className="option-time">{when(project.lastOpenedAt)}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="dialog-new" onClick={onCreate}>
            <span className="option-name">{newLabel}</span>
            <FittedText className="option-name new-name" text={newProjectName} lines={3} />
          </button>
        </li>
      </ul>
    </Dialog>
  );
}
