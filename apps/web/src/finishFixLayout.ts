// Finishing a `fix_layout` stage (DESIGN.md §6): every page gets an output (§5.8). The pages the person changed were
// saved as they worked; each of the others gets `layout`'s, with its systems sorted and its flag cleared, since
// finishing means every page was checked.

import { fetchJsonContent, putContent, recordOutputs, type ApiPipeline, type ApiStage, type Project } from "./api";
import { fixedLayout, fixLayoutNote, systemsChanged } from "./fixLayout";
import { canonicalJson } from "@score3ly/core";
import type { PageLayout } from "./layout";

// The content a page's layout is stored as: its canonical JSON.
export function layoutBytes(layout: PageLayout): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(canonicalJson(layout));
}

// Records what is missing and returns the card's note.
export async function finishFixLayout(project: Project, stage: ApiStage, pipeline: ApiPipeline): Promise<string> {
  const index = pipeline.stages.findIndex((s) => s.id === stage.id);
  const layout = pipeline.stages.slice(0, index).reverse().find((s) => s.step === "layout");
  if (!layout) throw new Error("There is no layout before this stage.");
  const own = new Map(stage.outputs.filter((o) => o.type === "layout").map((o) => [o.item, o]));
  const pages = layout.outputs.filter((o) => o.type === "layout" && o.contentSha256);
  let changed = 0;
  for (const output of pages) {
    const original = (await fetchJsonContent(output.contentSha256!)) as PageLayout;
    const saved = own.get(output.item);
    if (saved) {
      const fixed = (await fetchJsonContent(saved.contentSha256!)) as PageLayout;
      if (systemsChanged(original.systems, fixed.systems)) changed++;
      continue;
    }
    const sha256 = await putContent(layoutBytes(fixedLayout(original)), "application/json");
    await recordOutputs(project, stage.id, [
      { item: output.item, type: "layout", contentSha256: sha256, parentOutputId: output.id, inputIds: [output.id] },
    ]);
  }
  return fixLayoutNote(changed, pages.length);
}
