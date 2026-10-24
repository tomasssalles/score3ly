import type { ReactNode } from "react";
import { BackIcon, ForwardIcon } from "./icons";
import { Menu } from "./Menu";
import { useBackForward, useNoBrowserBar } from "./navigation";
import type { Page } from "./route";

// The app header: the <score3ly> wordmark, the project picker, the main action and the menu. Without a browser bar
// (an installed app, the desktop app), back and forward buttons left of the wordmark (DESIGN.md §3, "Navigation").
export function Header({
  picker,
  page,
  onNewProject,
}: {
  picker: ReactNode;
  page: Page | null; // the menu page that is open, if any
  onNewProject: () => void;
}) {
  const noBrowserBar = useNoBrowserBar();
  return (
    <header className={noBrowserBar ? "app-header with-history" : "app-header"}>
      <div className="brand">
        {noBrowserBar && <BackForwardButtons />}
        <h1 className="wordmark" aria-label="score3ly">
          <span className="bracket">&lt;</span>score3ly<span className="bracket">&gt;</span>
        </h1>
      </div>
      <div className="actions">
        <button type="button" className="button-primary" onClick={onNewProject}>
          + New<span className="new-project-word"> project</span>
        </button>
        <Menu current={page} />
      </div>
      {picker}
    </header>
  );
}

function BackForwardButtons() {
  const nav = useBackForward();
  return (
    <nav className="back-forward" aria-label="History">
      <button type="button" className="icon-button" aria-label="Back" title="Back" disabled={!nav.canGoBack} onClick={nav.back}>
        <BackIcon />
      </button>
      <button type="button" className="icon-button" aria-label="Forward" title="Forward" disabled={!nav.canGoForward} onClick={nav.forward}>
        <ForwardIcon />
      </button>
    </nav>
  );
}
