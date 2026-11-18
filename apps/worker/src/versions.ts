// Optimistic locking (docs/database.md, "Optimistic locking"): a project's version is raised by every change a person
// makes to it (its pipeline's stages and configs, a manual stage's saves and Finish, its name and run mode), and such a
// change is refused when the browser sends an older version than the project has: someone changed the project on
// another device or in another tab since this one last read it. The browser sends the version it last saw in the
// X-Project-Version header, and every answer about a project carries the current one in the same header. A request
// without the header isn't checked (scripts, tests, the manual tests' curl commands).
//
// Raised but not checked: what changes the pipeline without a person asking, so that a page that hasn't seen it can't
// make a change based on what it no longer is (a stage's start and end, a carried manual stage kept or dropped at its
// turn). Not checked, because it isn't a person's change made on a view that may be stale: the run goes on by itself,
// and the pipeline's own rules guard it (a running stage can't start again or be changed). Neither: a running stage's
// outputs, heartbeats and LLM calls, which change nothing another page could act on.
//
// Each route about a project declares its class where it is registered (`lock`), and a test walks the routes so that
// none goes undeclared (found 2026-11-17, the code review: the classes were read off the URL, and a new route fell
// through to "nothing" silently).

import type { Context, Hono, MiddlewareHandler } from "hono";
import { stageEntry } from "./pipelineRules.ts";
import { refuse } from "./refusals.ts";

export const VERSION_HEADER = "X-Project-Version";

export const STALE_MESSAGE = "This project was changed on another device or in another tab since this page loaded it, so this change wasn't made. Reload to see the project as it is now, then make the change again.";

// What a request does to the version: checked and raised (a person's change), only raised, or nothing.
type What = "checked" | "raised" | null;

// A route's lock class, declared where the route is registered (`lock`): what it does to the version, or, for the
// routes of a stage that are a person's on a manual stage and the run's otherwise (its saves and its Finish), what it
// does while the stage is WIP and otherwise.
export type Lock = "checked" | "raised" | "none" | { wip: What; otherwise: What };

const LOCKS = new WeakMap<object, Lock>();

// The lock class a route was registered with (`lock`), if any: a test walks the routes with it, so that no
// route about a project goes undeclared.
export function lockOf(handler: object): Lock | undefined {
  return LOCKS.get(handler);
}

function whatOf(lock: Lock, c: Context): What {
  if (lock === "none") return null;
  if (typeof lock === "string") return lock;
  return stageEntry(c).stage.status === "wip" ? lock.wip : lock.otherwise;
}

async function versionOf(db: D1Database, projectId: string): Promise<number | null> {
  return (await db.prepare("SELECT version FROM projects WHERE id = ? AND deleted_at IS NULL").bind(projectId).first<{ version: number }>())?.version ?? null;
}

// The project a request is about: /api/projects/:id/…
function projectOf(c: Context): string | undefined {
  return new URL(c.req.url).pathname.split("/").filter(Boolean)[2];
}

// A route's lock class, as a middleware registered with the route, before its handler:
// `app.post(path, lock("checked"), handler)`. A person's change is refused when the browser sent an older version than
// the project has; a change that succeeded raises it; and the answer says the version, for the browser's next change.
export function lock(declared: Lock): MiddlewareHandler<{ Bindings: Env }> {
  const middleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
    const db = c.env.DB;
    const projectId = projectOf(c);
    const what = projectId ? whatOf(declared, c) : null;
    if (projectId && what === "checked") {
      const sent = c.req.header(VERSION_HEADER);
      if (sent !== undefined) {
        const current = await versionOf(db, projectId);
        if (current !== null && String(current) !== sent.trim()) {
          c.header(VERSION_HEADER, String(current));
          return refuse(c, 409, STALE_MESSAGE, "stale_version");
        }
      }
    }
    await next();
    if (projectId && what !== null) {
      if (c.res.ok) await db.prepare("UPDATE projects SET version = version + 1 WHERE id = ?").bind(projectId).run();
      const current = await versionOf(db, projectId);
      if (current !== null) c.res.headers.set(VERSION_HEADER, String(current));
    }
  };
  LOCKS.set(middleware, declared);
  return middleware;
}

// Every GET about a project says its version too (the pipeline's, so that a page's refresh keeps it current).
export function versionRoutes(app: Hono<{ Bindings: Env }>) {
  // (Hono's "/api/projects/:id/*" matches "/api/projects/:id" itself too.)
  app.use("/api/projects/:id/*", async (c, next) => {
    await next();
    const projectId = projectOf(c);
    if (c.req.method === "GET" && projectId) {
      const current = await versionOf(c.env.DB, projectId);
      if (current !== null) c.res.headers.set(VERSION_HEADER, String(current));
    }
  });
}
