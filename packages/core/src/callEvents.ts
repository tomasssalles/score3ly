// What the Worker streams to the browser while a stage's LLM call runs, before its answer (docs/llm.md, "A call's
// progress"): the call's start (its id, when, and its timeout), and its progress at most every second: the characters
// received so far (the answer's, and the thinking's the provider shows), and the output tokens so far, thinking
// included, as the provider counted them in the latest chunk since the previous event that had a count, or null where
// none had (never an estimate). Both are totals, never what came since the previous event.
export type CallEvent =
  | { event: "started"; callId: string; startedAt: string; timeoutMs: number }
  | { event: "progress"; elapsedMs: number; outputTokens: number | null; textChars: number; thinkingChars: number };
