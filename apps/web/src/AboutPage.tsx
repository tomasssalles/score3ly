import { Fragment } from "react";
import { AUTHOR, REPOSITORY_URL, versionParts } from "./about";

export function AboutPage() {
  const version = versionParts({
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
        A music transcription tool, driven by vision LLMs, that converts printed scores into MEI, an open, XML-based
        standard for encoding music notation.
      </p>
      <dl className="about-facts">
        <dt>Version</dt>
        <dd className="mono">
          {/* The spaces between the parts sit outside them, so the line can break there. */}
          {version.map((part, i) => (
            <Fragment key={part}>
              {i > 0 && " "}
              <span className="nowrap">{part}</span>
            </Fragment>
          ))}
        </dd>
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
