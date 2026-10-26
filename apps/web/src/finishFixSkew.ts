// Finishing a `fix_skew` stage (DESIGN.md §6): every page gets an output (§5.8). The pages the person changed were
// saved as they worked; each of the others gets the lines `skew_analysis` found, as a person would have left them.

import { fetchJsonContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import { fixSkewNote, type PageLines } from "./fixSkew";
import { canonicalJson } from "@score3ly/core";
import { sha256Hex } from "@score3ly/core";

// The content a page's lines are stored as: their canonical JSON (so the same lines are the same content).
export function linesBytes(lines: PageLines): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(canonicalJson(lines));
}

// Records what is missing and returns the card's note.
export async function finishFixSkew(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const index = pipeline.stages.findIndex((s) => s.id === stage.id);
  const skew = pipeline.stages.slice(0, index).reverse().find((s) => s.step === "skew_analysis");
  if (!skew) throw new Error("There is no skew analysis before this stage.");
  const own = new Map(stage.outputs.filter((o) => o.type === "lines").map((o) => [o.item, o]));
  const pages = skew.outputs.filter((o) => o.type === "skew" && o.contentSha256);
  let changed = 0;
  for (const output of pages) {
    const found = (await fetchJsonContent(output.contentSha256!)) as PageLines;
    const bytes = linesBytes({ lines: found.lines });
    const saved = own.get(output.item);
    if (saved) {
      if (saved.contentSha256 !== (await sha256Hex(bytes))) changed++;
      continue;
    }
    const sha256 = await putContent(bytes, "application/json");
    await recordOutputs(project, stage.id, [
      { item: output.item, type: "lines", contentSha256: sha256, parentOutputId: output.id, inputIds: [output.id] },
    ]);
  }
  return fixSkewNote(changed, pages.length);
}
