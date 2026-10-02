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
  return { piece, method, lyName: fileName, pdfName: `${piece}.${method}.pdf` };
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
