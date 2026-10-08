// Made-up artifact contents for the mock pipeline (mockPipeline.ts): drawn score pages and systems, and texts.
// Remove together with the mock.

import type { Output } from "./pipeline";

// A small deterministic random generator, so the same item always looks the same.
function random(seed: number): () => number {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAPER = "#f3eedf";
const INK = "#2b2a28";

// One piano system (two staves) at (x, y), `width` wide, with made-up notes.
function system(x: number, y: number, width: number, rand: () => number, key: string) {
  const gap = 1.6; // between staff lines
  const staves = [y, y + 4 * gap + 7];
  const notes = [];
  for (const top of staves) {
    for (let nx = x + 10; nx < x + width - 3; nx += 3 + rand() * 3) {
      const ny = top + Math.round(rand() * 10 - 1) * (gap / 2);
      notes.push(<ellipse key={`${top}-${nx}`} cx={nx} cy={ny} rx={1} ry={0.75} fill={INK} />);
    }
  }
  const bars = [0.33, 0.66, 1].map((f) => x + 8 + (width - 8) * f);
  return (
    <g key={key}>
      {staves.flatMap((top) =>
        [0, 1, 2, 3, 4].map((l) => (
          <line key={`${top}-${l}`} x1={x} x2={x + width} y1={top + l * gap} y2={top + l * gap} stroke={INK} strokeWidth={0.25} />
        )),
      )}
      {bars.map((bx) => (
        <line key={bx} x1={bx} x2={bx} y1={staves[0]} y2={staves[1] + 4 * gap} stroke={INK} strokeWidth={0.3} />
      ))}
      <line x1={x} x2={x} y1={staves[0]} y2={staves[1] + 4 * gap} stroke={INK} strokeWidth={0.4} />
      {notes}
    </g>
  );
}

const SYSTEMS_PER_PAGE = 5;
const SYSTEM_HEIGHT = 22.5;

// A scanned page with its systems. With `boxes`, the systems' boxes are drawn over it.
export function MockPage({ index, boxes = false }: { index: number; boxes?: boolean }) {
  const rand = random(index + 1);
  return (
    <svg className="mock-image" viewBox="0 0 85 125" role="img" aria-label={`Page ${index + 1}`}>
      <rect width="85" height="125" fill={PAPER} />
      {index === 0 && <rect x="27" y="4" width="31" height="3" rx="1" fill={INK} opacity={0.75} />}
      {Array.from({ length: SYSTEMS_PER_PAGE }, (_, s) => {
        const y = 11 + s * SYSTEM_HEIGHT;
        return (
          <g key={s}>
            {system(8, y, 69, rand, `s${s}`)}
            {boxes && (
              <rect x={6} y={y - 1.2} width={73} height={21.8} fill="none" stroke="#ff7b72" strokeWidth={0.6} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// One system, cropped from its page.
export function MockSystem({ index }: { index: number }) {
  const rand = random(1000 + index);
  return (
    <svg className="mock-image" viewBox="0 0 150 26" role="img" aria-label={`System ${index + 1}`}>
      <rect width="150" height="26" fill={PAPER} />
      {system(4, 4, 142, rand, "s")}
    </svg>
  );
}

const TEXTS: Record<string, string> = {
  Metadata: `{
  "title": "Kinderszenen",
  "subtitle": "Leichte Stücke für das Pianoforte",
  "composer": "Robert Schumann",
  "opus": "Op. 15",
  "editor": "Clara Schumann",
  "movements": [
    { "number": 1, "title": "Von fremden Ländern und Menschen", "page": 1 },
    { "number": 2, "title": "Kuriose Geschichte", "page": 2 },
    { "number": 3, "title": "Hasche-Mann", "page": 3 }
  ]
}`,
  "Corrected metadata": `{
  "title": "Kinderszenen",
  "composer": "Robert Schumann",
  "opus": "Op. 15"
}`,
  Structure: `{
  "staves": ["right hand", "left hand"],
  "voices": { "right hand": 2, "left hand": 1 },
  "key": "g \\\\major",
  "time": "2/4",
  "changes": [
    { "system": 18, "key": "e \\\\minor" },
    { "system": 31, "time": "3/4" }
  ],
  "repeats": [{ "from": 1, "to": 8 }],
  "themes": [{ "name": "A", "systems": [1, 2], "returns": [9, 41] }]
}`,
  Uncertainties: `[
  { "system": 12, "measure": 45, "voice": "rh1", "reason": "smudged, inferred from theme A in m. 3" },
  { "system": 23, "measure": 88, "voice": "lh", "reason": "accidental unclear: natural or sharp" },
  { "system": 31, "measure": 120, "voice": "rh2", "reason": "tie or slur?" }
]`,
  "Check results": `[
  { "system": 23, "measure": 88, "check": "duration", "found": "7/16", "expected": "2/4" },
  { "system": 40, "check": "measure count", "found": 3, "expected": 4 }
]`,
  Findings: `[
  { "system": 7, "measure": 26, "voice": "rh1", "type": "pitch", "confidence": 0.8,
    "text": "Second note should be b', not c''." },
  { "system": 23, "measure": 88, "voice": "lh", "type": "rhythm", "confidence": 0.9,
    "text": "Dotted quarter, not quarter." }
]`,
  Skeleton: `\\version "2.24.0"

\\header {
  title = "Kinderszenen"
  composer = "Robert Schumann"
  opus = "Op. 15"
}

global = { \\key g \\major \\time 2/4 }

rhOne = { }
rhTwo = { }
lh = { }

\\score {
  \\new PianoStaff <<
    \\new Staff = "rh" << \\global \\new Voice = "rhOne" { \\voiceOne \\rhOne }
                                 \\new Voice = "rhTwo" { \\voiceTwo \\rhTwo } >>
    \\new Staff = "lh" { \\global \\clef bass \\lh }
  >>
}`,
};

// The text of a text output, or of one item of a group.
export function mockText(output: Output, index = 0): string {
  if (output.kind === "lilypond" && output.count > 1) {
    const bar = index * 4 + 1;
    return `% System ${index + 1}
rhOne = \\fixed c' {
  \\barNumberCheck #${bar}
  d'8( b16 a g8 b) | d'8( b16 a g8 b) |
  c''8( a16 g fis8 a) | b4 r |
}
lh = \\fixed c {
  \\barNumberCheck #${bar}
  g,8 d' b d' | g,8 d' b d' |
  d8 a c' a | g,4 r |
}`;
  }
  if (output.title === "Score") return `${TEXTS.Skeleton.replace("rhOne = { }", "rhOne = { % 54 systems … }")}`;
  return TEXTS[output.title] ?? "{}";
}
