import type { ModelConfig, TestResult } from "./api";
import { dollars } from "./money.ts";

// What the test found, in words: the answer, how long it took and what it cost; or what went wrong.
export function resultText(result: TestResult, model: string, config: Pick<ModelConfig, "price">): string {
  const seconds = `${(result.durationMs / 1000).toFixed(1)} s`;
  if (result.status !== "ok") return `Failed (after ${seconds}): ${result.error ?? "The answer ended unexpectedly."}`;
  const cost =
    config.price.kind === "free" ? "$0.00 (free tier)"
    : result.costUsd === null ? "unknown (unpriced)"
    : `${dollars(result.costUsd)}${result.vatPercent > 0 ? " incl. VAT" : ""}`;
  return `Success: ${model} responded in the requested format in ${seconds}. Cost: ${cost}.`;
}
