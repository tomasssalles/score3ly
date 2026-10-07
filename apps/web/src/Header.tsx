// The app header: the <score3ly> wordmark and the main action.
export function Header({ onNewProject }: { onNewProject: () => void }) {
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
    </header>
  );
}
