// How long an LLM call may take before the Worker stops it (docs/llm.md, "Timeouts"), in minutes, by the step of the
// stage that makes it, and for a config's Test. Very generous for now (built 2026-11-14): the real values wait for the
// recorded calls' times (the task "Timeouts for LLM calls"). Long calls are normal: thinking at a high effort can take
// many minutes before the first word of the answer.
export const LLM_TIMEOUT_MINUTES: Record<string, number> = {
  layout: 60,
  analyze: 60,
  extract: 60,
  review: 60,
  apply_review: 60,
  test: 10,
};

// The timeout of a call made for a stage of this step ("test" for a config's Test): the longest of all for a step
// that has none of its own.
export function llmTimeoutMs(step: string): number {
  const minutes = LLM_TIMEOUT_MINUTES[step] ?? Math.max(...Object.values(LLM_TIMEOUT_MINUTES));
  return minutes * 60_000;
}

// What a call stopped by its timeout says.
export function timedOutMessage(timeoutMs: number): string {
  const minutes = timeoutMs / 60_000;
  const limit = minutes >= 1 ? `${Math.round(minutes)} minute${Math.round(minutes) === 1 ? "" : "s"}` : `${Math.round(timeoutMs / 1000)} seconds`;
  return `Timed out: no answer within ${limit}, the most this call may take, so it was stopped. Whether the provider billed it is unknown.`;
}

// A signal that aborts when `outer` does (the browser stopped waiting) or when the time is up, whichever comes first,
// with a plain abort either way, as the adapters expect (an `AbortSignal.timeout` would reject fetches with a
// TimeoutError instead). `timedOut` says which it was; `clear` ends the timer once the call is over.
export function withTimeout(outer: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; timedOut: () => boolean; clear: () => void } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}
