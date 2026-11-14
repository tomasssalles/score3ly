import type { MiddlewareHandler } from "hono";

// One log line of our own per API request (docs/database.md, "The Worker's logs"). Workers Logs shows every request
// with its CPU time, but replaces the parts of its URL that look like ids with "REDACTED", so a request can't be traced
// to its project, stage or item. Our line, logged during the request, shows under it: the path with its ids shortened
// to their first 7 characters (enough to find the row, `id LIKE 'abcdef1%'`), and what the route adds with `logFields`
// (the step, the item, the request's size, whether the answer came from the cache).

const fields = new WeakMap<Request, Record<string, unknown>>();

// Adds fields to the request's log line.
export function logFields(request: Request, more: Record<string, unknown>): void {
  fields.set(request, { ...fields.get(request), ...more });
}

// A path with every id in it (a UUID, a SHA-256) shortened to its first 7 characters, without dashes, and "..." to
// show that it is cut.
export function shortIds(path: string): string {
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32,}/gi, (id) => `${id.slice(0, 7)}...`);
}

// Only where Workers Logs collects the lines (deployed, and `wrangler dev`'s terminal), not in the tests or the desktop
// version's Node server, which run the same app.
const inWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

// Requests whose line is logged by the route itself, later (`deferLog`).
const deferred = new WeakSet<Request>();

function logLine(request: Request, status: number): void {
  if (!inWorkers) return;
  const bytes = Number(request.headers.get("content-length"));
  console.log({
    request: `${request.method} ${shortIds(new URL(request.url).pathname)}`,
    status,
    ...(bytes > 0 ? { bytes } : {}),
    ...fields.get(request),
  });
}

// For a response that goes on after the route returns (a streamed answer, docs/llm.md, "A call's progress"): the line
// is logged when the returned function is called, with the fields added until then, instead of when the route returns.
export function deferLog(request: Request): (status: number) => void {
  deferred.add(request);
  return (status) => logLine(request, status);
}

export const requestLog: MiddlewareHandler = async (c, next) => {
  await next();
  if (!deferred.has(c.req.raw)) logLine(c.req.raw, c.res.status);
};
