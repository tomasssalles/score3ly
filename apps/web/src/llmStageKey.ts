// An LLM stage's key (docs/overview.md §5.2), one for the five LLM steps: the step, its version, the stage's settings
// beyond its model config, and what the step's own key function gives (the prompt's version, the model, the images'
// recipe, the inputs' content). The model config's id isn't in it: the model is (its provider, model and effort), so
// that configs with the same model share their stages. The settings are there only when a step has any besides the
// model config (none so far, steps.ts `LLM_CONFIG`), so that today's keys stay as they were; a setting added later is
// in the key without a change here, and a stage run with another value of it isn't reused.

import { keyOf } from "@score3ly/core";

// The stage's config as its step reads it (steps.ts: `LLM_CONFIG.read`, the model config's id and any other setting).
export type LlmStageConfig = Record<string, unknown>;

export function llmStageKey(step: string, version: number, input: { config: LlmStageConfig } & Record<string, unknown>): Promise<string> {
  const { config, ...rest } = input;
  const { modelConfigId: _, ...settings } = config;
  return keyOf({ step, version, ...(Object.keys(settings).length > 0 ? { settings } : {}), ...rest });
}
