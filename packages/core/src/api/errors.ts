// What the Worker answers when it refuses a request (any status from 400 on): `error` says why, `code` names the
// refusal where the app reacts to it by code (docs/overview.md §5.8). Which text the user sees, and every refusal's code,
// are the error contract's (the code review's batch 9).

export type ErrorCode =
  | "stale_version" // the project changed elsewhere since the page read it (optimistic locking)
  | "running" // a stage of the project is running
  | "missing" // the PDF or content an import needs isn't uploaded yet
  | "same_values" // a model config with exactly these values exists
  | "default_model_config" // the default model config can't be deleted
  | "no_model_config" // an LLM stage names no model config
  | "deleted_model_config" // its model config was deleted
  | "unsupported_model_config" // the app no longer supports its model config
  | "unsupported" // the app has no adapter for the config's provider and family
  | "missing_secret" // a secret the config names isn't set
  | "spending_cap"; // the spending cap is reached

export type ApiErrorBody = { error: string; code?: ErrorCode };
