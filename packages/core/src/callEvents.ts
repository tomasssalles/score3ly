// What the Worker streams to the browser while a stage's LLM call runs, before its answer (docs/llm.md, "A call's
// progress"): the call's start (its id, when, and its timeout), and its progress at most every second: the output
// tokens so far, thinking included, exact where the provider counts them as it goes, else estimated from the
// characters received, and those characters (the answer's, and the thinking's the provider shows).
export type CallEvent =
  | { event: "started"; callId: string; startedAt: string; timeoutMs: number }
  | { event: "progress"; elapsedMs: number; outputTokens: number; exact: boolean; textChars: number; thinkingChars: number };
