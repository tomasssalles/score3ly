// Small line icons, drawn in the current text color.

// The pipeline: a short list of steps, each a node on a line with its label beside it.
// (Three dots alone would read as a "more" menu.)
export function PipelineIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v3M6 14v3M11 5h9M11 12h9M11 19h6" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 15.5h6M9 19h3" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CollapseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
