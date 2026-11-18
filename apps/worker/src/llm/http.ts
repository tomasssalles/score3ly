// The skeleton of the adapters that call their provider with a plain `fetch` (Gemini on AI Studio and Vertex AI,
// OpenRouter; docs/llm.md, "Calling the providers"): a JSON request, an HTTP error read from its body, a streamed answer
// read event by event, and one table of what a failure is (`LlmError.kind`), the same for every provider
// (adapters.contract.test.ts):
// - fetch itself fails: `network` (no connection), or `aborted` (the caller's signal);
// - the provider answers with an HTTP error: its status's kind (`kindForStatus`), with the status;
// - the answer can't be read (the connection breaks while it streams, an event that isn't JSON, a stream that ends
//   before the answer does): `unreadable_response`, or `aborted`;
// - an error sent as an event of the stream: its code's kind, without a status (the provider answered 200);
// - the caller's progress callback throws (a bug): `unknown`.

import { readSse } from "@score3ly/core";
import { type Fetch, kindForStatus, LlmError, type LlmProgress } from "./types.ts";

// A fetch that is never called as a method of another object, which the Workers runtime refuses ("Illegal invocation").
export function plainFetch(fetchFn?: Fetch): Fetch {
  const f = fetchFn ?? fetch;
  return (input, init) => f(input, init);
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

const ABORTED = "The request was aborted.";

// What a failure of fetch itself is: the caller's signal, or no connection.
export function fetchFailure(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (isAbort(err)) return new LlmError("aborted", ABORTED);
  return new LlmError("network", String(err));
}

// What a failure while reading a response is (`name`: the provider, as the message says it): the caller's signal, or an
// answer that couldn't be read.
export function readFailure(err: unknown, name: string): LlmError {
  if (err instanceof LlmError) return err;
  if (isAbort(err)) return new LlmError("aborted", ABORTED);
  return new LlmError("unreadable_response", `${name}'s answer was cut off: ${String(err)}`);
}

// POSTs a JSON body.
export async function postJson(fetchFn: Fetch, url: string, headers: HeadersInit, body: unknown, signal: AbortSignal | undefined): Promise<Response> {
  const sent = new Headers(headers);
  sent.set("content-type", "application/json");
  try {
    return await fetchFn(url, { method: "POST", headers: sent, body: JSON.stringify(body), signal });
  } catch (err) {
    throw fetchFailure(err);
  }
}

// The error an HTTP error status means, its message made by the adapter from the body's text.
export async function errorFromBody(response: Response, name: string, message: (text: string) => string): Promise<LlmError> {
  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    return readFailure(err, name);
  }
  return new LlmError(kindForStatus(response.status), message(text), response.status);
}

// An error the provider sent as an event of a stream that began with 200: the kind its code means (a server error
// where it has none), without an HTTP status.
export function streamError(code: unknown, message: string): LlmError {
  return new LlmError(typeof code === "number" ? kindForStatus(code) : "server", message);
}

// Reads a streamed answer's events as JSON, handing each to `onEvent` as it arrives. `notJson` says what an event
// that isn't JSON is; `skip` names data that isn't an event (OpenRouter's "[DONE]").
export async function sseJson<T>(
  response: Response,
  options: { name: string; notJson: (data: string) => string; skip?: string },
  onEvent: (event: T) => void,
): Promise<void> {
  try {
    await readSse(response, (data) => {
      if (data === options.skip) return;
      let event: T;
      try {
        event = JSON.parse(data) as T;
      } catch {
        throw new LlmError("unreadable_response", options.notJson(data));
      }
      onEvent(event);
    });
  } catch (err) {
    throw readFailure(err, options.name);
  }
}

// The caller's progress callback, a throw from it made an `unknown` error (a bug, not the provider's), so that it isn't
// mistaken for a failure of the connection.
export function progressReporter(onProgress: ((progress: LlmProgress) => void) | undefined): (progress: LlmProgress) => void {
  return (progress) => {
    if (!onProgress) return;
    try {
      onProgress({ ...progress });
    } catch (err) {
      throw new LlmError("unknown", `Reporting the call's progress failed: ${String(err)}`);
    }
  };
}

// An answer that the stream ended before it was finished (no finish reason).
export function endedEarly(name: string): LlmError {
  return new LlmError("unreadable_response", `${name}'s answer ended before it was finished.`);
}
