import { type Box, boxProblem } from "./crop.ts";

// Named regions of a score's pages: systems, measures, details. In JSON, an object mapping each name (e.g.
// "system_3", "measure_12", "detail_1") to {"page": <number, from 1>, "bbox": <a Box>}.
export type Region = { name: string; page: number; box: Box };

// Names become file names, so they are kept to letters, digits, "_", "-" and ".", not starting with a dot.
const NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

// The regions in a parsed JSON value, in the JSON's order. Throws with every problem found, by name.
export function parseRegions(json: unknown): Region[] {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("Expected an object mapping names to regions.");
  }
  const regions: Region[] = [];
  const problems: string[] = [];
  for (const [name, value] of Object.entries(json)) {
    if (!NAME.test(name)) {
      problems.push(`"${name}": the name may only have letters, digits, "_", "-" and "."`);
      continue;
    }
    if (typeof value !== "object" || value === null) {
      problems.push(`"${name}": not an object`);
      continue;
    }
    const { page, bbox } = value as Record<string, unknown>;
    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
      problems.push(`"${name}": "page" must be a whole number from 1`);
      continue;
    }
    const problem = boxProblem(bbox);
    if (problem) {
      problems.push(`"${name}": "bbox" ${problem}`);
      continue;
    }
    regions.push({ name, page, box: bbox as Box });
  }
  if (problems.length > 0) throw new Error(`Invalid regions:\n${problems.join("\n")}`);
  return regions;
}
