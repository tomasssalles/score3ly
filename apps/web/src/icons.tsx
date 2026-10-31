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

// A quarter note turning into a letter: `extract` transcribes the music into text.
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

// The inverse of `extract`'s: a letter turning into a quarter note. `engrave` turns the text into engraved music.
export function EngraveIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 3.1c.6-.4 1.4-.6 2.4-.6 1.7 0 2.6.7 2.6 2.3V9" />
      <path d="M8.2 5.5H5.6C4 5.5 3 6.2 3 7.3c0 1 .8 1.7 1.9 1.7 1.4 0 2.6-.7 3.3-1.8" />
      <path d="M11.3 11.3l3.5 3.5M14.8 11.6v3.2h-3.2" />
      <ellipse className="filled-shape" cx="17.4" cy="20" rx="2.4" ry="1.8" transform="rotate(-20 17.4 20)" />
      <path d="M19.6 19.4v-6.5" />
    </svg>
  );
}

// Candidates for `review` and `apply_review` (to pick one pair). In the style of `extract`'s and `engrave`'s: a quarter
// note turning into a question mark (`review` turns the music into questions), and back (`apply_review` turns the
// answered questions into music).
export function ReviewIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse className="filled-shape" cx="5.4" cy="9.6" rx="2.4" ry="1.8" transform="rotate(-20 5.4 9.6)" />
      <path d="M7.6 9V2.5" />
      <path d="M10.5 10.5l3.5 3.5M14 10.8V14h-3.2" />
      <path d="M16.3 16.9c0-1.3 1-2.1 2.3-2.1s2.3.8 2.3 2c0 1.4-2.3 1.6-2.3 3" />
      <path d="M18.6 21.9h0" />
    </svg>
  );
}

export function ApplyReviewIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.7 4.1c0-1.3 1-2.1 2.3-2.1s2.3.8 2.3 2c0 1.4-2.3 1.6-2.3 3" />
      <path d="M6 9.2h0" />
      <path d="M11.3 11.3l3.5 3.5M14.8 11.6v3.2h-3.2" />
      <ellipse className="filled-shape" cx="17.4" cy="20" rx="2.4" ry="1.8" transform="rotate(-20 17.4 20)" />
      <path d="M19.6 19.4v-6.5" />
    </svg>
  );
}

// The other candidates of `review`'s: "a?", an answer in question, and a quarter note in question.
export function ReviewLettersIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.3 10.05c.9-.6 2.1-.9 3.6-.9 2.55 0 3.9 1.05 3.9 3.45v6.3" />
      <path d="M10.8 13.65H6.9C4.5 13.65 3 14.7 3 16.35c0 1.5 1.2 2.55 2.85 2.55 2.1 0 3.9-1.05 4.95-2.7" />
      <path d="M13.5 8.4c0-2.1 1.65-3.3 3.75-3.3S21 6.3 21 8.4c0 3-3.75 3.15-3.75 6.45" />
      <path d="M17.25 17.9h0" />
    </svg>
  );
}

// "a?" small at the top left, and the arrow.
function SmallAQuestionArrow() {
  return (
    <>
      <path d="M2.16 4.64c.48-.32 1.12-.48 1.92-.48 1.36 0 2.08.56 2.08 1.84v3.36" />
      <path d="M6.16 6.56H4.08C2.8 6.56 2 7.12 2 8c0 .8.64 1.36 1.52 1.36 1.12 0 2.08-.56 2.64-1.44" />
      <path d="M8.1 3.76C8.1 2.64 8.98 2 10.1 2s2 .64 2 1.76c0 1.4-2 1.5-2 3" />
      <path d="M10.1 9.4h0" />
      <path d="M12 12l3.4 3.4M15.4 12.8v2.6h-2.6" />
    </>
  );
}

export function ReviewNoteIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse className="filled-shape" cx="6.2" cy="16.2" rx="2.9" ry="2.15" transform="rotate(-20 6.2 16.2)" />
      <path d="M8.85 15.5V4.6" />
      <path d="M13.5 8.4c0-2.1 1.65-3.3 3.75-3.3S21 6.3 21 8.4c0 3-3.75 3.15-3.75 6.45" />
      <path d="M17.25 17.9h0" />
    </svg>
  );
}

// Candidates of `review`'s as a decisive corrector: what is wrong crossed out, struck through or circled by hand. The
// pen strokes are filled outlines of varying width (made by a script: pressure at the start, a taper at the end), so
// that a cross doesn't read as the letter x.
const CROSS = ["M4.09 4.93 4.57 5.57 5.07 6.19 5.59 6.8 6.12 7.42 6.67 8.03 7.23 8.65 7.81 9.27 8.4 9.89 9.01 10.51 9.63 11.13 10.26 11.76 10.91 12.38 11.57 13 12.25 13.62 12.94 14.24 13.65 14.85 14.37 15.47 15.1 16.08 15.84 16.69 16.6 17.29 17.36 17.9 18.14 18.49 18.93 19.09 19.73 19.68 19.87 19.52 19.18 18.81 18.51 18.09 17.84 17.37 17.19 16.66 16.55 15.94 15.92 15.23 15.3 14.52 14.68 13.81 14.06 13.12 13.45 12.43 12.85 11.74 12.24 11.07 11.63 10.41 11.03 9.76 10.42 9.13 9.81 8.51 9.19 7.91 8.57 7.32 7.95 6.75 7.32 6.2 6.68 5.67 6.04 5.17 5.39 4.69 4.71 4.27 4.5 4.16 4.27 4.17 4.07 4.29 3.96 4.5 3.97 4.73Z", "M18.72 3.72 18.08 4.15 17.47 4.63 16.86 5.14 16.25 5.68 15.64 6.23 15.04 6.81 14.43 7.41 13.83 8.03 13.23 8.67 12.62 9.32 12.03 9.99 11.43 10.68 10.83 11.37 10.24 12.08 9.64 12.8 9.05 13.53 8.46 14.26 7.87 15.01 7.28 15.76 6.69 16.51 6.1 17.26 5.51 18.02 4.92 18.78 4.33 19.53 4.47 19.67 5.18 19.02 5.89 18.37 6.6 17.73 7.3 17.08 8 16.42 8.7 15.77 9.39 15.12 10.08 14.47 10.75 13.82 11.42 13.17 12.08 12.52 12.72 11.87 13.36 11.23 13.98 10.58 14.59 9.94 15.18 9.3 15.76 8.66 16.32 8.03 16.86 7.4 17.39 6.77 17.9 6.15 18.39 5.53 18.86 4.92 19.28 4.28 19.39 4.1 19.39 3.9 19.28 3.72 19.1 3.61 18.9 3.61Z"];

// A glyph drawn larger than its own coordinates, with strokes of the usual width.
function Scaled({ x, y, scale, children }: { x: number; y: number; scale: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ strokeWidth: 1.7 / scale }}>
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

// "b", 4.4 × 7.7 units from the origin.
function GlyphB() {
  return (
    <>
      <path d="M0 0v7.7" />
      <path d="M0 5.2c0-1.5 1-2.5 2.2-2.5s2.2 1 2.2 2.5-1 2.5-2.2 2.5S0 6.7 0 5.2" />
    </>
  );
}

// A quarter note, as in `extract`'s icon: about 4.8 × 8.9 units from the origin.
function GlyphNote() {
  return (
    <>
      <ellipse className="filled-shape" cx="2.4" cy="7.1" rx="2.4" ry="1.8" transform="rotate(-20 2.4 7.1)" />
      <path d="M4.6 6.5V0" />
    </>
  );
}

// "c", the height of the "a": 5 × 6.5 units from the origin.
function GlyphC() {
  return <path d="M5 1C4.4.35 3.6 0 2.7 0 1.1 0 0 1.4 0 3.25S1.1 6.5 2.7 6.5c.9 0 1.7-.35 2.3-1" />;
}

// "a" struck through, "c" written above it; the "a" larger than in ReviewStrikeIcon.
export function ReviewStrikeCIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={2.4} y={12} scale={1.5}>
        <GlyphA />
      </Scaled>
      <path className="brush" d="M2.84 23.41 3.27 23 3.66 22.55 4.04 22.07 4.4 21.58 4.76 21.06 5.12 20.52 5.46 19.97 5.8 19.4 6.13 18.82 6.45 18.23 6.78 17.62 7.09 17.01 7.41 16.39 7.72 15.76 8.03 15.12 8.34 14.47 8.66 13.83 8.97 13.17 9.29 12.52 9.62 11.87 9.95 11.21 10.28 10.56 10.63 9.91 10.98 9.26 10.82 9.14 10.33 9.7 9.85 10.27 9.38 10.84 8.91 11.41 8.45 12 8.01 12.58 7.57 13.17 7.14 13.76 6.73 14.36 6.33 14.95 5.94 15.55 5.56 16.14 5.19 16.73 4.84 17.32 4.5 17.91 4.18 18.49 3.87 19.07 3.58 19.65 3.3 20.22 3.03 20.78 2.78 21.33 2.55 21.88 2.34 22.43 2.16 22.99 2.1 23.19 2.15 23.39 2.29 23.54 2.49 23.6 2.69 23.55Z" />
      <Scaled x={14.8} y={3} scale={1.25}>
        <GlyphC />
      </Scaled>
    </svg>
  );
}

// "a" circled, "c" written above it.
export function ReviewCircleCIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={3.7} y={12.75} scale={1.15}>
        <GlyphA />
      </Scaled>
      <path className="brush" d="M6.98 10.55 7.58 10.74 8.13 10.97 8.67 11.27 9.17 11.62 9.63 12.04 10.05 12.51 10.43 13.03 10.75 13.59 11.02 14.18 11.22 14.8 11.37 15.44 11.45 16.09 11.47 16.73 11.43 17.37 11.32 18 11.16 18.6 10.93 19.16 10.65 19.69 10.33 20.17 9.96 20.6 9.55 20.98 9.11 21.29 8.64 21.55 8.15 21.74 7.64 21.86 7.12 21.92 6.59 21.91 6.06 21.83 5.53 21.69 5.01 21.48 4.51 21.2 4.04 20.85 3.59 20.45 3.18 19.99 2.82 19.48 2.51 18.93 2.25 18.34 2.05 17.72 1.91 17.08 1.84 16.43 1.83 15.78 1.88 15.13 2.01 14.5 2.19 13.9 2.44 13.32 2.74 12.79 3.1 12.3 3.51 11.86 3.97 11.48 4.46 11.16 4.99 10.91 5.55 10.73 6.13 10.63 6.73 10.6 7.33 10.65 7.93 10.78 7.98 10.59 7.38 10.39 6.75 10.28 6.11 10.25 5.47 10.3 4.83 10.44 4.22 10.66 3.63 10.96 3.07 11.34 2.56 11.8 2.1 12.33 1.7 12.91 1.36 13.55 1.09 14.23 0.89 14.95 0.77 15.7 0.72 16.46 0.76 17.23 0.87 17.99 1.06 18.74 1.33 19.47 1.67 20.16 2.08 20.82 2.55 21.42 3.09 21.96 3.68 22.43 4.32 22.82 4.99 23.14 5.7 23.36 6.43 23.5 7.17 23.53 7.9 23.47 8.62 23.31 9.32 23.05 9.98 22.71 10.59 22.27 11.15 21.76 11.65 21.18 12.08 20.53 12.43 19.84 12.71 19.1 12.91 18.33 13.02 17.54 13.05 16.73 12.99 15.93 12.85 15.13 12.63 14.36 12.33 13.61 11.96 12.91 11.52 12.25 11.02 11.66 10.46 11.13 9.85 10.68 9.2 10.31 8.52 10.03 7.82 9.84 7.13 9.77 6.92 9.78 6.75 9.9 6.66 10.08 6.68 10.29 6.79 10.46Z" />
      <Scaled x={14.6} y={2.2} scale={1.4}>
        <GlyphC />
      </Scaled>
    </svg>
  );
}

export function ReviewCrossIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={8.1} y={7.1} scale={1.5}>
        <GlyphA />
      </Scaled>
      <path className="brush" d={CROSS[0]} />
      <path className="brush" d={CROSS[1]} />
    </svg>
  );
}

export function ReviewCrossNoteIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={8.6} y={5.8} scale={1.4}>
        <GlyphNote />
      </Scaled>
      <path className="brush" d={CROSS[0]} />
      <path className="brush" d={CROSS[1]} />
    </svg>
  );
}

// "a" struck through, "b" written above it: a proofreader's correction.
export function ReviewStrikeIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={3.2} y={11} scale={1.25}>
        <GlyphA />
      </Scaled>
      <path className="brush" d="M2.69 20.67 3.12 20.41 3.52 20.11 3.9 19.79 4.28 19.46 4.66 19.11 5.03 18.74 5.39 18.37 5.75 17.98 6.11 17.58 6.46 17.16 6.81 16.73 7.15 16.3 7.5 15.85 7.85 15.39 8.19 14.91 8.54 14.43 8.89 13.94 9.24 13.44 9.6 12.93 9.96 12.41 10.33 11.89 10.7 11.35 11.08 10.81 11.47 10.27 11.33 10.13 10.82 10.58 10.33 11.02 9.84 11.46 9.37 11.89 8.9 12.31 8.44 12.73 7.99 13.15 7.55 13.57 7.12 13.98 6.7 14.39 6.29 14.8 5.9 15.2 5.51 15.61 5.14 16.01 4.78 16.42 4.43 16.82 4.09 17.23 3.77 17.63 3.45 18.04 3.15 18.44 2.87 18.85 2.59 19.27 2.33 19.69 2.11 20.13 2.01 20.31 2.02 20.52 2.13 20.69 2.31 20.79 2.52 20.78Z" />
      <Scaled x={15.6} y={3} scale={1}>
        <GlyphB />
      </Scaled>
    </svg>
  );
}

// A quarter note circled, as a teacher marks a mistake (a circled "a" reads as "@").
export function ReviewCircleIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <Scaled x={8.6} y={6.2} scale={1.3}>
        <GlyphNote />
      </Scaled>
      <path className="brush" d="M13.25 3.37 14.18 3.7 15.04 4.12 15.85 4.63 16.61 5.23 17.3 5.91 17.92 6.68 18.45 7.5 18.9 8.39 19.25 9.31 19.5 10.27 19.65 11.25 19.7 12.23 19.65 13.21 19.5 14.16 19.25 15.08 18.9 15.96 18.47 16.79 17.96 17.54 17.37 18.23 16.72 18.83 16.01 19.34 15.25 19.76 14.45 20.08 13.63 20.29 12.78 20.41 11.92 20.41 11.07 20.32 10.22 20.11 9.4 19.81 8.61 19.4 7.86 18.9 7.16 18.3 6.53 17.63 5.96 16.88 5.48 16.07 5.08 15.2 4.77 14.3 4.56 13.36 4.45 12.41 4.44 11.45 4.53 10.5 4.72 9.57 5 8.67 5.38 7.82 5.85 7.03 6.4 6.3 7.03 5.64 7.72 5.08 8.48 4.6 9.28 4.22 10.13 3.95 11 3.78 11.89 3.72 12.79 3.78 13.68 3.95 14.56 4.23 14.63 4.04 13.75 3.7 12.84 3.46 11.9 3.34 10.96 3.34 10.02 3.46 9.09 3.69 8.2 4.05 7.35 4.51 6.55 5.09 5.81 5.76 5.16 6.53 4.59 7.38 4.12 8.3 3.74 9.29 3.48 10.31 3.33 11.37 3.29 12.45 3.36 13.54 3.56 14.61 3.86 15.66 4.28 16.67 4.8 17.63 5.43 18.52 6.14 19.34 6.94 20.07 7.82 20.69 8.76 21.21 9.74 21.61 10.77 21.88 11.82 22.02 12.88 22.03 13.93 21.91 14.96 21.65 15.96 21.26 16.9 20.75 17.77 20.12 18.57 19.38 19.28 18.54 19.89 17.62 20.4 16.63 20.79 15.58 21.06 14.48 21.22 13.35 21.25 12.21 21.15 11.07 20.94 9.94 20.6 8.85 20.15 7.8 19.6 6.81 18.94 5.89 18.19 5.06 17.35 4.33 16.45 3.71 15.49 3.21 14.48 2.83 13.47 2.61 13.27 2.6 13.08 2.7 12.98 2.88 12.97 3.09 13.08 3.27Z" />
    </svg>
  );
}

// The other candidates of `apply_review`'s: "a?" turning into "c", the answer changed, and "a" turning into "c".
export function ApplyReviewLettersCIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <SmallAQuestionArrow />
      <path d="M21.4 17.5c-.5-.5-1.2-.8-2-.8-1.3 0-2.2 1.1-2.2 2.5s.9 2.5 2.2 2.5c.8 0 1.5-.3 2-.8" />
    </svg>
  );
}

export function ApplyReviewACIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.2 3.1c.6-.4 1.4-.6 2.4-.6 1.7 0 2.6.7 2.6 2.3V9" />
      <path d="M8.2 5.5H5.6C4 5.5 3 6.2 3 7.3c0 1 .8 1.7 1.9 1.7 1.4 0 2.6-.7 3.3-1.8" />
      <path d="M10 10l3.5 3.5M13.5 10.3v3.2h-3.2" />
      <path d="M21 16.3c-.6-.6-1.5-1-2.5-1-1.7 0-2.9 1.4-2.9 3.25s1.2 3.25 2.9 3.25c1 0 1.9-.4 2.5-1" />
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
