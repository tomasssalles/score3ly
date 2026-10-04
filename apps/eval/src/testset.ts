// File naming in the test set (DESIGN.md §13, testset/README.md).

export const TESTSET_DIR = new URL("../../../testset/", import.meta.url).pathname;

// "orig" names the input score, so it can't be an extraction method.
export const ORIG = "orig";

// How a candidate's source file is turned into a PDF.
export type Format = "ly" | "musicxml";

// LilyPond candidates are compiled with LilyPond. MusicXML candidates (from OMR tools) are
// rendered directly with MuseScore, so they're judged without a lossy musicxml2ly conversion.
const FORMATS: Format[] = ["ly", "musicxml"];

export type Candidate = {
  piece: string;
  method: string;
  format: Format;
  sourceName: string;
  pdfName: string;
};

// Parses "<piece>.<method>.<format>". Returns null for any other name.
export function parseCandidate(fileName: string): Candidate | null {
  const match = /^([^.]+)\.([^.]+)\.([^.]+)$/.exec(fileName);
  if (match === null || match[2] === ORIG || !isFormat(match[3])) {
    return null;
  }
  const [, piece, method, format] = match;
  return { piece, method, format, sourceName: fileName, pdfName: pdfName(piece, method) };
}

function isFormat(extension: string): extension is Format {
  return (FORMATS as string[]).includes(extension);
}

function formatOf(fileName: string): Format | null {
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1);
  return isFormat(extension) ? extension : null;
}

export type EngravePlan = {
  toEngrave: Candidate[];
  alreadyEngraved: Candidate[];
  invalidNames: string[]; // .ly or .musicxml files that don't follow the naming scheme
  conflicts: Candidate[]; // candidates sharing a piece and method (hence a PDF) with another one
};

export function planEngraving(fileNames: string[]): EngravePlan {
  const existing = new Set(fileNames);
  const plan: EngravePlan = { toEngrave: [], alreadyEngraved: [], invalidNames: [], conflicts: [] };
  const candidates: Candidate[] = [];
  for (const name of [...fileNames].sort()) {
    if (formatOf(name) === null) {
      continue;
    }
    const candidate = parseCandidate(name);
    if (candidate === null) {
      plan.invalidNames.push(name);
    } else {
      candidates.push(candidate);
    }
  }
  const pdfCounts = new Map<string, number>();
  for (const candidate of candidates) {
    pdfCounts.set(candidate.pdfName, (pdfCounts.get(candidate.pdfName) ?? 0) + 1);
  }
  for (const candidate of candidates) {
    if (pdfCounts.get(candidate.pdfName)! > 1) {
      plan.conflicts.push(candidate);
    } else if (existing.has(candidate.pdfName)) {
      plan.alreadyEngraved.push(candidate);
    } else {
      plan.toEngrave.push(candidate);
    }
  }
  return plan;
}

export type Piece = {
  name: string;
  hasOrig: boolean; // whether <piece>.orig.pdf exists
  methods: string[]; // methods with an engraving <piece>.<method>.pdf, sorted
};

// Groups the PDFs "<piece>.<orig or method>.pdf" by piece, sorted by name.
export function listPieces(fileNames: string[]): Piece[] {
  const pieces = new Map<string, Piece>();
  for (const name of fileNames) {
    const match = /^([^.]+)\.([^.]+)\.pdf$/.exec(name);
    if (match === null) {
      continue;
    }
    const [, pieceName, source] = match;
    let piece = pieces.get(pieceName);
    if (piece === undefined) {
      piece = { name: pieceName, hasOrig: false, methods: [] };
      pieces.set(pieceName, piece);
    }
    if (source === ORIG) {
      piece.hasOrig = true;
    } else {
      piece.methods.push(source);
    }
  }
  for (const piece of pieces.values()) {
    piece.methods.sort();
  }
  return [...pieces.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function pdfName(piece: string, source: string): string {
  return `${piece}.${source}.pdf`;
}

// Where the viewer's dev server serves a test-set file (see testsetServer.ts).
export function testsetUrl(fileName: string): string {
  return `/testset/${encodeURIComponent(fileName)}`;
}
