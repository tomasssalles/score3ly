import type { ReactNode } from "react";

// The app header: the <score3ly> wordmark, the project picker and the main action.
export function Header({ picker, onNewProject }: { picker: ReactNode; onNewProject: () => void }) {
  return (
    <header className="app-header">
      <h1 className="wordmark" aria-label="score3ly">
        <span className="bracket">&lt;</span>score3ly<span className="bracket">&gt;</span>
      </h1>
      <div className="actions">
        <button type="button" className="button-primary" onClick={onNewProject}>
          + New project
        </button>
      </div>
      {picker}
    </header>
  );
}
