import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody, ErrorCode } from "@score3ly/core";
import { logFields } from "./requestLog.ts";

// The error contract (docs/style.md, "Error texts"): every refusal answers `{ error, code? }`. `error` is the text the
// user sees: a short sentence they understand first, then what a developer needs to find the cause. `code` names the
// refusal where the app reacts to it (`ErrorCode`, core). The reason goes into the request's log line too.
export function refuse(c: Context, status: ContentfulStatusCode, error: string, code?: ErrorCode): Response {
  logFields(c.req.raw, { refused: code ?? status, reason: error.slice(0, 300) });
  return c.json<ApiErrorBody>(code ? { error, code } : { error }, status);
}

// What anything thrown inside a route becomes (`app.onError`): the same JSON as a refusal, with the code "internal", and
// the error in the log.
export function failed(err: unknown, c: Context): Response {
  const message = err instanceof Error ? err.message : String(err);
  logFields(c.req.raw, { error: message.slice(0, 1000) });
  console.error(err);
  return c.json<ApiErrorBody>({ error: `The server failed to answer this request. Details: ${message}`, code: "internal" }, 500);
}
