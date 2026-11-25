// How an LLM call ended, as the statistics tell calls apart (docs/statistics.md): the Worker's SQL names them, the
// browser labels them. Lists, so that the types come from them and a test can check every outcome is labelled and every
// outcome the SQL gives is listed.

// Why a provider's call failed (the Worker's `LlmError` kinds, stored as `llm_calls.error_kind`).
export const CALL_ERROR_KINDS = [
  "auth", // the key is wrong, or not allowed to use the model
  "rate_limit",
  "overloaded",
  "bad_request", // the request itself is wrong: retrying won't help
  "server",
  "network", // no connection to the provider
  "timeout", // the connection timed out
  "aborted", // the request was aborted from our side
  "unreadable_response", // the provider answered, but its response couldn't be read (broken JSON, a stream cut short)
  "unexpected_model", // another model answered than the one asked: not thrown, the response says so (`unexpectedModel`)
  "unknown", // anything else the client library threw
] as const;
export type CallErrorKind = (typeof CALL_ERROR_KINDS)[number];

// A call's outcome (`OUTCOME`, apps/worker/src/callRecords.ts), in Usage and Costs alike: "ok", how an answer was
// unusable, why the call failed, an error without a kind ("unexpected_stop"), or a call that will never answer
// ("interrupted"); in Usage, also "cached": an answer served from the record, a row of its own that wasn't a call made
// (the code review's E4, the owner's dec. 16).
export const OUTCOMES = ["ok", "cut_off", "refused", "unparseable", ...CALL_ERROR_KINDS, "unexpected_stop", "interrupted", "cached"] as const;
export type Outcome = (typeof OUTCOMES)[number];

// A paid call's outcome in Costs (apps/worker/src/costs.ts): the outcomes a call with a cost can have: an answer, used or
// not, another model answering ("unexpected_model"), or an error with a cost ("unexpected_stop").
export type CostOutcome = Extract<Outcome, "ok" | "cut_off" | "refused" | "unparseable" | "unexpected_model" | "unexpected_stop">;
