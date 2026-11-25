// The replay fixture of the fake model (docs/overview.md §12) as the Worker would send it to the browser, in the version
// the snapshot guards were taken on (fixtures/exports/format-1-fake.s3l: the fixture until the code review's batch 32
// remade it, which gave its rows new ids; the guards hash ids, so they read this one, frozen): its pipeline (stages and
// outputs, in the Worker's order), its stored content, its LLM calls and what each stage recorded as its inputs. For
// tests in Node that need a real pipeline.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import type { ApiPipeline, ApiStage } from "../api.ts";

type Row = Record<string, unknown>;

export type Fixture = {
  pipeline: ApiPipeline;
  content: Map<string, Uint8Array>;
  calls: { stageId: string; item: string; round: number; status: string; responseSha256: string | null }[];
  stageInputs: Map<string, string[]>; // by stage id: the ids of the outputs it read, as recorded
};

export function fakeFixture(): Fixture {
  const files = unzipSync(readFileSync(join(import.meta.dirname, "../../../../fixtures/exports/format-1-fake.s3l")));
  const rows = JSON.parse(new TextDecoder().decode(files["project.json"])) as Record<string, Row[]>;
  const content = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(files)) if (name.startsWith("content/")) content.set(name.slice("content/".length), bytes);
  const outputs = [...rows.outputs].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.item).localeCompare(String(b.item)));
  const stageOf = new Map(rows.stages.map((s) => [s.id as string, s]));
  const stages: ApiStage[] = [...rows.pipeline]
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((entry) => {
      const s = stageOf.get(entry.stage_id as string)!;
      return {
        id: s.id as string,
        step: s.step as string,
        stepVersion: s.step_version as number | null,
        status: s.status as ApiStage["status"],
        config: s.config_json ? (JSON.parse(s.config_json as string) as Record<string, unknown>) : null,
        pageCount: s.page_count as number | null,
        error: s.error as string | null,
        note: s.note as string | null,
        startedAt: s.started_at as string | null,
        heartbeatAt: null,
        interrupted: false,
        finishedAt: (s.finished_at as string | null) ?? null,
        runMs: null,
        modelConfig: null,
        costUsd: null,
        carried: entry.carried === 1,
        inRecipe: s.in_recipe === 1,
        outputs: outputs
          .filter((o) => o.stage_id === s.id)
          .map((o) => ({
            id: o.id as string,
            item: o.item as string,
            type: o.type as string,
            contentSha256: o.content_sha256 as string | null,
            recipeKey: o.recipe_key as string | null,
            recipe: o.recipe_json ? JSON.parse(o.recipe_json as string) : null,
          })),
      };
    });
  const stageInputs = new Map<string, string[]>();
  for (const r of rows.stage_inputs) stageInputs.set(r.stage_id as string, [...(stageInputs.get(r.stage_id as string) ?? []), r.output_id as string]);
  return {
    pipeline: { stages, dropped: [] },
    content,
    calls: rows.llm_calls.map((c) => ({
      stageId: c.stage_id as string,
      item: c.item as string,
      round: c.round as number,
      status: c.status as string,
      responseSha256: c.response_sha256 as string | null,
    })),
    stageInputs,
  };
}
