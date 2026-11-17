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

// Texts more than one route sends.

// A request only a bug of the app (or a script) sends: its shape is wrong.
export const BAD_REQUEST = "The app sent the server a request it can't use, probably because of a bug.";

export function badRequest(c: Context, details: string): Response {
  return refuse(c, 400, `${BAD_REQUEST} Details: ${details}`);
}

// A check's problem, as the user sees it: one written as a sentence (a capital first) is the user's, as it is; one
// about a field's shape (lower case, or a quoted field first) only a bug sends.
export function problemText(problem: string): string {
  return /^[A-Z]/.test(problem) ? problem : `${BAD_REQUEST} Details: ${problem}`;
}

export const NO_PROJECT = "This project doesn't exist any more: it may have been deleted on another device.";
export const NO_MODEL_CONFIG = "This model config doesn't exist any more: it may have been deleted on another device.";
export const NO_STAGE = "This stage isn't in the project's pipeline any more: it may have been replaced in another tab or on another device. Reload to see the pipeline as it is.";
export function notRunning(status: string): string {
  return `The stage isn't running any more: it may have been stopped or finished in another tab or on another device. Reload to see the pipeline as it is. Details: its status is "${status}".`;
}
export const WAITS_FOR_TURN = "The stage waits for its turn: the stages before it run first.";
export const STAGE_RUNNING = "A stage of this project is running. Stop it, or let it finish, then try again.";
// The pipeline changed since the page read it, in a way the version doesn't catch (a running stage's start or end).
export const RELOAD = "It may have changed in another tab or on another device: reload to see the pipeline as it is.";
export const PICK_ANOTHER = "Pick another with \"Change config\" in the stage's ⋮.";
export const PICK_ONE = "Pick one with \"Change config\" in the stage's ⋮, then retry.";
