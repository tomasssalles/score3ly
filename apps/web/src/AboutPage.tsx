import { Fragment, useEffect, useState } from "react";
import { AUTHOR, pricesStale, REPOSITORY_URL, versionParts } from "./about";
import { fetchPrices } from "./api";
import { shortDate } from "./time";

export function AboutPage() {
  const [pricesAsOf, setPricesAsOf] = useState<string | null>(null);
  useEffect(() => {
    fetchPrices().then((prices) => setPricesAsOf(prices.asOf), () => {});
  }, []);
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
        {pricesAsOf && (
          <>
            <dt>LLM prices</dt>
            <dd>
              As of {shortDate(pricesAsOf)}, used to estimate costs.
              {pricesStale(pricesAsOf) && <span className="stale"> Older than three months: costs may be off.</span>}
            </dd>
          </>
        )}
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
          <a href={`${REPOSITORY_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
            GNU Affero General Public License, version 3
          </a>
          : anyone may use, change and share the code, but whoever shares it, or lets others use a changed version over
          a network, must offer its source code under the same license. © 2026 {AUTHOR}.
        </dd>
        <dt>Third-party code</dt>
        <dd>
          Libraries, fonts and the MEI schema by others, under their own licenses:{" "}
          <a href={`${REPOSITORY_URL}/blob/main/THIRD_PARTY_NOTICES.md`} target="_blank" rel="noopener noreferrer">
            the notices
          </a>
          .
        </dd>
      </dl>
    </div>
  );
}
