// How an LLM call ended, as the statistics tell calls apart (docs/statistics.md): the Worker's SQL names them, the
// browser labels them.

// Why a provider's call failed (the Worker's `LlmError` kinds, stored as `llm_calls.error_kind`).
export type CallErrorKind =
  | "auth" // the key is wrong, or not allowed to use the model
  | "rate_limit"
  | "overloaded"
  | "bad_request" // the request itself is wrong: retrying won't help
  | "server"
  | "network" // no connection to the provider
  | "timeout" // the connection timed out
  | "aborted" // the request was aborted from our side
  | "unreadable_response" // the provider answered, but its response couldn't be read (broken JSON, a stream cut short)
  | "unexpected_model" // another model answered than the one asked: not thrown, the response says so (`unexpectedModel`)
  | "unknown"; // anything else the client library threw

// A call's outcome in Usage (apps/worker/src/failures.ts): "ok", how an answer was unusable, why the call failed, an
// error without a kind ("unexpected_stop"), or a call that will never answer ("interrupted").
export type Outcome = "ok" | "cut_off" | "refused" | "unparseable" | CallErrorKind | "unexpected_stop" | "interrupted";

// A paid call's outcome in Costs (apps/worker/src/costs.ts): its status, another model answering ("wrong_model"), or
// an error with a cost ("unexpected_stop").
export type CostOutcome = "ok" | "cut_off" | "refused" | "unparseable" | "wrong_model" | "unexpected_stop";
