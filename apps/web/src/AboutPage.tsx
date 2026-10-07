import { AUTHOR, REPOSITORY_URL, versionText } from "./about";

export function AboutPage() {
  const version = versionText({
    version: __APP_VERSION__,
    commit: __APP_COMMIT__,
    dirty: __APP_DIRTY__,
    dev: import.meta.env.DEV,
  });
  return (
    <div className="page-view about">
      <p className="wordmark about-wordmark" aria-label="score3ly">
        <span className="bracket">&lt;</span>score3ly<span className="bracket">&gt;</span>
      </p>
      <p className="about-summary">
        Turns printed musical scores into MEI and LilyPond, with vision LLMs doing the reading.
      </p>
      <dl className="about-facts">
        <dt>Version</dt>
        <dd className="mono">{version}</dd>
        <dt>Author</dt>
        <dd>{AUTHOR}</dd>
        <dt>Source code</dt>
        <dd>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            {REPOSITORY_URL.replace("https://", "")}
          </a>
        </dd>
        <dt>License</dt>
        <dd>
          None yet, so all rights are reserved: the source code can be read on GitHub, but not copied, changed or
          shared. © 2026 {AUTHOR}.
        </dd>
      </dl>
    </div>
  );
}
