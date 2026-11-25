// What the statistics routes share (docs/statistics.md): how a project counts as finished, the pages a `rasterize`
// stage selected, and how a model config is read and summed up. What a call's row means is callRecords.ts'.

import { parsePages, type FailureData } from "@score3ly/core";
import { modelGroupOf, resolvedModel } from "./llm/models.ts";
import type { ModelConfigRow } from "./modelConfigs.ts";

// A column of the last stage of a project's pipeline, for a project row named `p`.
export const lastStage = (column: string) =>
  `(SELECT s.${column} FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id ORDER BY e.position DESC LIMIT 1)`;

// Whether the project `p` is finished: its pipeline's last stage (always engrave) is done.
export const FINISHED = `${lastStage("status")} = 'done'`;

// The pages a `rasterize` stage selected, as its stored config writes them out ("1-12, 15", resolved when it started), or
// none where the config can't be read.
export function rasterizedPages(configJson: string | null): number[] {
  if (!configJson) return [];
  const selection = (JSON.parse(configJson) as { pages?: unknown }).pages;
  const parsed = typeof selection === "string" ? parsePages(selection) : null;
  return parsed && !("error" in parsed) ? parsed.pages : [];
}

// A model config's columns the statistics read, and what they send of it: its name, its model and the model's group
// (whatever the provider), and when it was created and ended.
export const CONFIG_COLUMNS = "id, name, provider, model_id, model_string, family, created_at, deleted_at";
export type ConfigColumns = Pick<ModelConfigRow, "id" | "name" | "provider" | "model_id" | "model_string" | "family" | "created_at" | "deleted_at">;

export function configSummary(m: ConfigColumns): FailureData["configs"][number] {
  return { id: m.id, name: m.name, model: resolvedModel(m).model, ...modelGroupOf(m), createdAt: m.created_at, deletedAt: m.deleted_at };
}
