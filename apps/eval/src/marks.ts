// Highlighter strokes, stored per PDF in "<piece>.<source>.marks.jsonl", one stroke per line
// (DESIGN.md §13).

export type Point = [x: number, y: number]; // relative to the page: 0..1 left to right, top to bottom

export type Stroke = {
  page: number; // 1-based
  color: string; // name from HIGHLIGHT_COLORS
  width: number; // line width relative to the page width
  pdfSha256: string; // the PDF the stroke was drawn on
  points: Point[];
};

// All loaded strokes, plus the order in which strokes were added in this session (for undo).
export type Marks = {
  byPdf: Record<string, Stroke[]>; // key: PDF file name
  history: string[]; // PDF file names, one entry per added stroke, oldest first
};

export const NO_MARKS: Marks = { byPdf: {}, history: [] };

export function marksName(pdfName: string): string {
  return pdfName.replace(/\.pdf$/, ".marks.jsonl");
}

export function withLoaded(marks: Marks, pdf: string, strokes: Stroke[]): Marks {
  return { ...marks, byPdf: { ...marks.byPdf, [pdf]: strokes } };
}

export function withStroke(marks: Marks, pdf: string, stroke: Stroke): Marks {
  return {
    byPdf: { ...marks.byPdf, [pdf]: [...(marks.byPdf[pdf] ?? []), stroke] },
    history: [...marks.history, pdf],
  };
}

// Removes the most recently added stroke. Returns null if there is nothing to undo.
export function withoutLastStroke(marks: Marks): { marks: Marks; pdf: string } | null {
  const pdf = marks.history.at(-1);
  if (pdf === undefined) {
    return null;
  }
  return {
    marks: {
      byPdf: { ...marks.byPdf, [pdf]: (marks.byPdf[pdf] ?? []).slice(0, -1) },
      history: marks.history.slice(0, -1),
    },
    pdf,
  };
}

export function serializeMarks(strokes: Stroke[]): string {
  return strokes.map((s) => `${JSON.stringify(s)}\n`).join("");
}

export function parseMarks(text: string): Stroke[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Stroke);
}
