// Small line icons, drawn in the current text color.

// An MEI file: the same sheet as a PDF's, with its own name (`engrave`'s artifact).
export function MeiIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3h11l5 5v13H4z" />
      <path d="M15 3v5h5" />
      <text className="icon-text" x="12" y="16.3" textAnchor="middle">
        MEI
      </text>
    </svg>
  );
}

// A PDF: a sheet with a folded corner, wide enough for its name.
export function PdfIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3h11l5 5v13H4z" />
      <path d="M15 3v5h5" />
      <text className="icon-text" x="12" y="16.3" textAnchor="middle">
        PDF
      </text>
    </svg>
  );
}

// A warning triangle: a stage failed and stopped the pipeline (the collapsed strip, §5.6).
export function WarningIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </svg>
  );
}

// A pause sign: the pipeline waits for the user (the collapsed strip, §5.6).
export function PauseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 7v10M14.5 7v10" />
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

// Back and forward in the app's history: arrows, so they aren't mistaken for the chevrons that collapse and expand.
export function BackIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function ForwardIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronUpIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

// Back to the top: an arrow up to a line.
export function TopIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14M12 20V8M7 13l5-5 5 5" />
    </svg>
  );
}

// Downloading a file: an arrow down into a tray.
export function DownloadIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 15v5h16v-5" />
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

// Skew detection: a tilted line against a level one, and the angle between them.
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

// A magnifying glass: search.
export function SearchIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
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

// A box drawn by two opposite corners: a dashed rectangle with a dot at two corners.
export function BoxIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <circle cx="5" cy="5" r="2" fill="currentColor" />
      <circle cx="19" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

// A bar line across a staff.
export function BarLineIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h18M3 10.5h18M3 14h18M3 17.5h18" strokeWidth="1" />
      <path d="M12 5v15" strokeWidth="2.4" />
    </svg>
  );
}

// A magnifying glass over a page of music: analyze.
export function AnalyzeIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h10v7M5 3v18h7" />
      <path d="M8 7h5M8 10h3" />
      <circle cx="16" cy="15" r="4" />
      <path d="M19 18l3 3" />
    </svg>
  );
}

// The music stages' icons tell a story: `extract` sees a note (a "c") and writes "a"; `review` marks the "a" as
// wrong, with the "c" written above it, on the transcription; `apply_review` replaces the "a" with the "c" in a new
// transcription; `engrave` makes the note again from the "c".

// `extract`: a quarter note turning into an "a".
export function ExtractIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse className="filled-shape" cx="5.4" cy="9.6" rx="2.4" ry="1.8" transform="rotate(-20 5.4 9.6)" />
      <path d="M7.6 9V2.5" />
      <path d="M10.5 10.5l3.5 3.5M14 10.8V14h-3.2" />
      <path d="M15.8 15.9c.6-.4 1.4-.6 2.4-.6 1.7 0 2.6.7 2.6 2.3v4.2" />
      <path d="M20.8 18.3h-2.6c-1.6 0-2.6.7-2.6 1.8 0 1 .8 1.7 1.9 1.7 1.4 0 2.6-.7 3.3-1.8" />
    </svg>
  );
}

// `review`: an "a" struck through by hand, a "c" written above it. The strike is a filled outline of varying width
// (pressure at the start, a taper at the end), so that it looks written by hand.
export function ReviewIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={2.4} y={11.4} scale={1.5} weight={2.3}>
        <GlyphA />
      </Scaled>
      <path className="brush" d="M3.55 23.94 3.98 23.45 4.37 22.92 4.75 22.36 5.12 21.78 5.47 21.17 5.81 20.54 6.15 19.89 6.48 19.22 6.8 18.53 7.11 17.82 7.42 17.1 7.73 16.36 8.03 15.6 8.33 14.83 8.63 14.04 8.93 13.24 9.23 12.43 9.54 11.61 9.84 10.77 10.16 9.92 10.48 9.07 10.81 8.2 11.14 7.33 11.49 6.44 11.31 6.36 10.82 7.17 10.34 7.97 9.86 8.77 9.4 9.57 8.95 10.35 8.51 11.13 8.08 11.9 7.66 12.67 7.26 13.42 6.87 14.17 6.49 14.9 6.12 15.63 5.77 16.35 5.43 17.06 5.11 17.75 4.8 18.44 4.5 19.12 4.22 19.78 3.95 20.43 3.69 21.08 3.45 21.71 3.23 22.33 3.02 22.94 2.85 23.56 2.8 23.76 2.86 23.96 3.01 24.1 3.21 24.15 3.41 24.09Z" />
      <Scaled x={15.4} y={3.4} scale={1.1} weight={2.3}>
        <GlyphC />
      </Scaled>
    </svg>
  );
}

// `apply_review`: an "a" turning into a "c".
export function ApplyReviewIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 3.1c.6-.4 1.4-.6 2.4-.6 1.7 0 2.6.7 2.6 2.3V9" />
      <path d="M8.2 5.5H5.6C4 5.5 3 6.2 3 7.3c0 1 .8 1.7 1.9 1.7 1.4 0 2.6-.7 3.3-1.8" />
      <path d="M10.65 10.65l3.5 3.5M14.15 10.95v3.2h-3.2" />
      <path d="M21 16.3c-.6-.6-1.5-1-2.5-1-1.7 0-2.9 1.4-2.9 3.25s1.2 3.25 2.9 3.25c1 0 1.9-.4 2.5-1" />
    </svg>
  );
}

// `engrave`: a "c" turning into a quarter note.
export function EngraveIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.4 3.5c-.6-.6-1.5-1-2.5-1-1.7 0-2.9 1.4-2.9 3.25s1.2 3.25 2.9 3.25c1 0 1.9-.4 2.5-1" />
      <path d="M10.7 11.3l3.5 3.5M14.2 11.6v3.2h-3.2" />
      <ellipse className="filled-shape" cx="17.4" cy="20" rx="2.4" ry="1.8" transform="rotate(-20 17.4 20)" />
      <path d="M19.6 19.4v-6.5" />
    </svg>
  );
}

// A glyph drawn larger than its own coordinates, its strokes as wide as unscaled ones.
// `weight`: the stroke's width (1.7 is the usual).
function Scaled({ x, y, scale, weight = 1.7, children }: { x: number; y: number; scale: number; weight?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ strokeWidth: weight / scale }}>
      {children}
    </g>
  );
}

// "a", 5.2 × 6.5 units from the origin.
function GlyphA() {
  return (
    <>
      <path d="M.2.6c.6-.4 1.4-.6 2.4-.6 1.7 0 2.6.7 2.6 2.3v4.2" />
      <path d="M5.2 3H2.6C1 3 0 3.7 0 4.8c0 1 .8 1.7 1.9 1.7 1.4 0 2.6-.7 3.3-1.8" />
    </>
  );
}

// "c", the height of the "a": 5 × 6.5 units from the origin.
function GlyphC() {
  return <path d="M5 1C4.4.35 3.6 0 2.7 0 1.1 0 0 1.4 0 3.25S1.1 6.5 2.7 6.5c.9 0 1.7-.35 2.3-1" />;
}

// Two links of a chain: scrolling and zooming are linked between two panels (`human_review`); the button unlinks them.
export function LinkIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="12.25" width="12" height="5.5" rx="2.75" transform="rotate(-45 9 15)" />
      <rect x="9" y="6.25" width="12" height="5.5" rx="2.75" transform="rotate(-45 15 9)" />
    </svg>
  );
}

// The chain broken: the links apart, with the marks of the break. The panels scroll and zoom on their own; the button
// links them again.
export function UnlinkIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="13.75" width="10" height="5.5" rx="2.75" transform="rotate(-45 7.5 16.5)" />
      <rect x="11.5" y="4.75" width="10" height="5.5" rx="2.75" transform="rotate(-45 16.5 7.5)" />
      <path d="M8.5 3.5v2.5M3.5 8.5H6M15.5 20.5V18M20.5 15.5H18" />
    </svg>
  );
}

// A staff with two boxes on it: shows or hides the boxes of issues and warnings on the score. The staff is lighter, so
// the boxes stand out at the icon's size.
export function BoxesIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path className="faint-stroke" d="M3 6h18M3 9h18M3 12h18M3 15h18M3 18h18" />
      <rect x="3.5" y="4" width="9.5" height="7" rx=".5" />
      <rect x="10" y="15.3" width="10.5" height="4.7" rx=".5" />
    </svg>
  );
}

// </>: the raw source, as against its rendering.
export function SourceIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />
    </svg>
  );
}

// A plus: add something.
export function PlusIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// An eye: show something (e.g. a field in the score).
export function EyeIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// A check mark: done.
export function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// A funnel: filters (the costs view).
export function FilterIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 5h17l-6.5 7.5V19l-4 1.5v-8z" />
    </svg>
  );
}

// One bar standing on an axis, cut into stacked parts, larger towards the bottom: splitting a chart into groups (the costs
// view).
export function SplitIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 20.5h17M8 20.5V4h8v16.5" />
      <path d="M8 7.5h8M8 12h8" />
    </svg>
  );
}

// Bars: amounts per day, week or month (the costs view).
export function BarsIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3" height="6" />
      <rect x="10.5" y="6" width="3" height="11" />
      <rect x="15.5" y="9" width="3" height="8" />
    </svg>
  );
}

// A rising line: a running total (the costs view).
export function RunningTotalIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16" />
      <path d="M4.5 17l4-2.5 3.5 1 3-5.5 4.5-4" />
    </svg>
  );
}

// An "i" in a circle: more about something, on demand.
export function InfoIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </svg>
  );
}
