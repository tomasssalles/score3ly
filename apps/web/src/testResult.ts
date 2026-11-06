import type { ModelConfig, TestResult } from "./api";
import { dollars } from "./money.ts";

// What the test found, in words: the answer, how long it took and what it cost; or what went wrong.
export function resultText(result: TestResult, model: string, config: Pick<ModelConfig, "price">): string {
  const seconds = `${(result.durationMs / 1000).toFixed(1)} s`;
  if (result.status !== "ok") return `Failed (after ${seconds}): ${result.error ?? "The answer ended unexpectedly."}`;
  const cost =
    config.price.kind === "free" ? "$0.00 (free tier)"
    : result.costUsd === null ? "unknown (unpriced)"
    : dollars(result.costUsd);
  // The answer is the JSON's `colour`: missing only if the provider let the model answer outside the schema.
  const answer = result.answer ? `with "${result.answer}"` : "without the answer asked for";
  return `Success: ${model} responded ${answer} in ${seconds}. Cost: ${cost}.`;
}
