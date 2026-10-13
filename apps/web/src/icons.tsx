// Small line icons, drawn in the current text color.

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

export function ExpandIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

// Three stacked dots: more actions for the thing it sits next to.
export function MoreIcon() {
  return (
    <svg className="icon filled" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

// Ingest: the PDF uploaded to the app.
export function IngestIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v5h16v-5" />
    </svg>
  );
}

// The steps that have an icon of their own (StageCard.tsx), and image artifacts.
export function ImageIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M3.5 18l5.5-5 4 3.5 2.5-2.5 5 4.5" />
    </svg>
  );
}

// Skew analysis: a tilted line against a level one, and the angle between them.
export function SkewIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 18.5h17M3.5 18.5 19 9.5" />
      <path d="M12 18.5a8.5 8.5 0 0 0-1-4" />
    </svg>
  );
}

// Layout: systems as boxes on a page.
export function LayoutIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <rect x="6.5" y="6" width="11" height="4.5" />
      <rect x="6.5" y="13" width="11" height="4.5" />
    </svg>
  );
}

export function ComputedIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </svg>
  );
}

export function LlmIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />
      <path d="M18.5 16v4M16.5 18h4" />
    </svg>
  );
}

// A wrench: every manual stage shows it (they all fix something by hand).
export function ManualIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg className="icon filled" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

// A circular arrow: try a failed stage again.
export function RetryIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12a7 7 0 1 1-2.05-4.95" />
      <path d="M19 4v4h-4" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg className="icon filled" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

// Structured text (JSON) and music source (LilyPond), for output tiles without a picture.
export function DataIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4c-2 0-2.5 1-2.5 3v2.5C6.5 11 5.5 12 4 12c1.5 0 2.5 1 2.5 2.5V17c0 2 .5 3 2.5 3" />
      <path d="M15 4c2 0 2.5 1 2.5 3v2.5c0 1.5 1 2.5 2.5 2.5-1.5 0-2.5 1-2.5 2.5V17c0 2-.5 3-2.5 3" />
    </svg>
  );
}

export function MusicIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17V5l9-2v12" />
      <ellipse cx="7.5" cy="17.5" rx="2.5" ry="2" />
      <ellipse cx="16.5" cy="15.5" rx="2.5" ry="2" />
    </svg>
  );
}

// The skew editor's tools.

export function HandIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7-2.5 0-4-1.2-5.3-3.3L3.5 14a1.5 1.5 0 0 1 2.6-1.5L8 15" />
    </svg>
  );
}

// A line with its two ends: drawing a line by its ends.
export function LineIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 15.8l9.6-7.6" />
      <circle cx="5.5" cy="17.2" r="2.2" fill="currentColor" />
      <circle cx="18.5" cy="6.8" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function ZoomInIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20M8 10.5h5M10.5 8v5" />
    </svg>
  );
}

export function ZoomOutIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20M8 10.5h5" />
    </svg>
  );
}

export function FitIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a5.5 5.5 0 0 0 0 11h3" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
