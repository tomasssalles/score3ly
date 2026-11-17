// What the Worker answers when it refuses a request (any status from 400 on), and when a route fails (500): `error` is
// the text the user sees, written by the Worker (docs/style.md, "Error texts"); `code` names the refusal where the app
// reacts to it by code, never by the status.

export type ErrorCode =
  | "stale_version" // the project changed elsewhere since the page read it (optimistic locking)
  | "running" // a stage of the project is running
  | "name_taken" // another project or model config has that name (ignoring case)
  | "missing" // the PDF or content an import needs isn't uploaded yet
  | "same_values" // a model config with exactly these values exists
  | "default_model_config" // the default model config can't be deleted
  | "no_model_config" // an LLM stage names no model config
  | "deleted_model_config" // its model config was deleted
  | "unsupported_model_config" // the app no longer supports its model config
  | "unsupported" // the app has no adapter for the config's provider and family
  | "missing_secret" // a secret the config names isn't set
  | "spending_cap" // the spending cap is reached
  | "bad_secret" // a secret the config names is set but can't be used (e.g. a key file that doesn't parse)
  | "unplaced_calls" // the project has LLM calls without a place, which the one-time script fills
  | "internal"; // the server failed (anything thrown inside a route)

export type ApiErrorBody = { error: string; code?: ErrorCode };
