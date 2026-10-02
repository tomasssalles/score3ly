// File naming in the test set (DESIGN.md §13, testset/README.md).

export const TESTSET_DIR = new URL("../../../testset/", import.meta.url).pathname;

// "orig" names the input score, so it can't be an extraction method.
export const ORIG = "orig";

export type Candidate = {
  piece: string;
  method: string;
  lyName: string;
  pdfName: string;
};

// Parses "<piece>.<method>.ly". Returns null for any other name.
export function parseCandidate(fileName: string): Candidate | null {
  const match = /^([^.]+)\.([^.]+)\.ly$/.exec(fileName);
  if (match === null || match[2] === ORIG) {
    return null;
  }
  const [, piece, method] = match;
  return { piece, method, lyName: fileName, pdfName: pdfName(piece, method) };
}

export type EngravePlan = {
  toEngrave: Candidate[];
  alreadyEngraved: Candidate[];
  invalidNames: string[]; // .ly files that don't follow the naming scheme
};

export function planEngraving(fileNames: string[]): EngravePlan {
  const existing = new Set(fileNames);
  const plan: EngravePlan = { toEngrave: [], alreadyEngraved: [], invalidNames: [] };
  for (const name of [...fileNames].sort()) {
    if (!name.endsWith(".ly")) {
      continue;
    }
    const candidate = parseCandidate(name);
    if (candidate === null) {
      plan.invalidNames.push(name);
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
