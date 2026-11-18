// How a call ended, in words (`Outcome`, core; the Worker's `OUTCOME`, apps/worker/src/callRecords.ts), for the Usage tab's
// failed calls and the Costs tab's call status alike: the provider refused it, it got no readable response, its answer
// couldn't be used, our side was wrong, or the app was closed while it waited.

import type { Outcome } from "@score3ly/core";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  ok: "Succeeded",
  overloaded: "Overloaded",
  rate_limit: "Rate limited",
  server: "Server error",
  network: "No connection",
  timeout: "Timed out",
  aborted: "Aborted",
  unreadable_response: "Unreadable response",
  cut_off: "Cut off",
  refused: "Refused",
  unparseable: "Unusable answer",
  unexpected_model: "Wrong model",
  unexpected_stop: "Unexpected stop",
  auth: "Bad credentials",
  bad_request: "Bad request",
  unknown: "Unknown error",
  interrupted: "Interrupted",
};
