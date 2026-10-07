import type { ReactNode } from "react";
import { Menu } from "./Menu";
import type { Page } from "./route";

// The app header: the <score3ly> wordmark, the project picker, the main action and the menu.
export function Header({
  picker,
  page,
  onNewProject,
}: {
  picker: ReactNode;
  page: Page | null; // the menu page that is open, if any
  onNewProject: () => void;
}) {
  return (
    <header className="app-header">
      <h1 className="wordmark" aria-label="score3ly">
        <span className="bracket">&lt;</span>score3ly<span className="bracket">&gt;</span>
      </h1>
      <div className="actions">
        <button type="button" className="button-primary" onClick={onNewProject}>
          + New project
        </button>
        <Menu current={page} />
      </div>
      {picker}
    </header>
  );
}
