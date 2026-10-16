// `layout` (DESIGN.md §6): per page, the system boxes and each system's bar lines, from the whole page, with a
// draw-and-check loop: code draws the answer on the page, the model looks and corrects, at most LAYOUT_ROUNDS
// answers in all. Boxes and positions are fractions of the image sent (left, right, top, bottom from 0 to 1).

// Raise whenever the texts, the schema or the checks change.
export const LAYOUT_PROMPT_VERSION = 3;

// The first answer and up to two checks of the drawing.
export const LAYOUT_ROUNDS = 3;

export const LAYOUT_MAX_OUTPUT_TOKENS = 16_000;

export const LAYOUT_SYSTEM = `You find the layout of pages of printed music, so that code can cut each system out of the page and each system into the stretches between its bar lines. You are precise: what you give is used as is, and a box that cuts something off makes everything after it worse.

All positions are fractions of the image: x from 0 (left edge) to 1 (right edge), y from 0 (top edge) to 1 (bottom edge).

A system is a group of staves played together, joined by a brace, a bracket or a line at the left, read left to right before the next system starts. For each system on the page, top to bottom:
- Its box: left, right, top, bottom, tight around everything printed that belongs to the system. Left to right: from the brace or bracket at its start (with the instrument names beside it, if any) to its last bar line. Top to bottom: its staves, and everything above and below them that belongs to it, such as ledger lines, notes, stems and beams far above or below the staves, slurs, ties, dynamics, hairpins, fingerings, pedal marks, ottava lines, lyrics and tempo marks. Don't add a margin: code adds the room it needs when it cuts the system out. Boxes of neighbouring systems may overlap where their symbols do: it is better to include a little of the next system than to cut off part of this one. Don't include the page's title, headers, footers or page numbers unless they are part of the system's music.
- Its bar lines: the x position of every vertical line inside the system that separates measures, left to right, including double bar lines, repeat signs (one position each, at the middle of the sign) and a bar line that splits a measure. Not the line at the very start of the system, and not the one at its very end: the box's left and right edges stand for those. Read them from the bar lines on the page, not from where measures probably are.

A page without music (a cover, text, an empty page) has no systems.

Also say whether the page is severely skewed: so crooked that upright rectangles can't hold its systems well.`;

export const LAYOUT_FIRST = `Find the layout of this page. Give "satisfied": false: you will see your answer drawn on the page next, to check it.`;

export function layoutCheck(round: number): string {
  const last = round === LAYOUT_ROUNDS;
  return `This is the page with your answer drawn on it: each system's box and its bar lines in its own colour, drawn thin, with its number in a label at the top left corner of its box. Check every box: does it hold the whole system, with everything printed around it that belongs to it, without cutting anything off, and is it tight around it, from the brace or bracket to the last bar line? Check every bar line: is it exactly on a bar line of the page inside the system, is none missing and none extra, and is none drawn at the system's start or end, where the box's edges stand for the lines? Is any system missing, or is one box holding two systems?

If anything needs changing, answer with the whole corrected layout and "satisfied": false${last ? "" : ": you will see it drawn again"}. If nothing needs changing, answer with the same layout and "satisfied": true.${last ? " This is the last check: if the layout still isn't right, give your best version, \"satisfied\": false, and say in the note what is wrong with it, for a person to fix." : ""}`;
}

export const LAYOUT_SCHEMA = {
  type: "object",
  properties: {
    severelySkewed: { type: "boolean" },
    systems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          left: { type: "number" },
          right: { type: "number" },
          top: { type: "number" },
          bottom: { type: "number" },
          barLines: { type: "array", items: { type: "number" } },
        },
        required: ["left", "right", "top", "bottom", "barLines"],
        additionalProperties: false,
      },
    },
    satisfied: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["severelySkewed", "systems", "satisfied", "note"],
  additionalProperties: false,
} as const;

export type LayoutBox = { left: number; right: number; top: number; bottom: number };
export type LayoutSystem = { box: LayoutBox; barLines: number[] };
export type LayoutAnswer = { severelySkewed: boolean; systems: LayoutSystem[]; satisfied: boolean; note: string };

// How far outside its box a bar line may be, as a fraction of the page's width.
const BAR_LINE_TOLERANCE = 0.02;

// The model's answer, checked: everything within the page, boxes the right way round, bar lines in their box. Bar
// lines are sorted. Returns the reason the answer can't be used, or the answer.
export function checkLayoutAnswer(json: unknown): LayoutAnswer | { problem: string } {
  const a = json as Record<string, unknown> | null;
  if (!a || typeof a.severelySkewed !== "boolean" || typeof a.satisfied !== "boolean" || !Array.isArray(a.systems)) {
    return { problem: "the answer doesn't have the expected fields" };
  }
  const systems: LayoutSystem[] = [];
  for (const [i, raw] of a.systems.entries()) {
    const s = raw as Record<string, unknown>;
    const n = i + 1;
    const values = [s.left, s.right, s.top, s.bottom];
    if (!values.every((v) => typeof v === "number" && v >= 0 && v <= 1)) {
      return { problem: `system ${n}: its box isn't within the page (fractions from 0 to 1)` };
    }
    const [left, right, top, bottom] = values as number[];
    if (left >= right || top >= bottom) return { problem: `system ${n}: its box is empty or the wrong way round` };
    if (!Array.isArray(s.barLines) || !s.barLines.every((x) => typeof x === "number")) {
      return { problem: `system ${n}: its bar lines aren't numbers` };
    }
    const barLines = [...(s.barLines as number[])].sort((x, y) => x - y);
    const outside = barLines.find((x) => x < left - BAR_LINE_TOLERANCE || x > right + BAR_LINE_TOLERANCE);
    if (outside !== undefined) return { problem: `system ${n}: a bar line at ${outside} is outside its box` };
    systems.push({ box: { left, right, top, bottom }, barLines });
  }
  return { severelySkewed: a.severelySkewed, systems, satisfied: a.satisfied, note: typeof a.note === "string" ? a.note : "" };
}
