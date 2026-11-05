// Optimistic locking (docs/database.md, "Optimistic locking"): a project's version is raised by every change a person
// makes to it (its pipeline's stages and configs, a manual stage's saves and Finish, its name and run mode), and such a
// change is refused when the browser sends an older version than the project has: someone changed the project on
// another device or in another tab since this one last read it. The browser sends the version it last saw in the
// X-Project-Version header, and every answer about a project carries the current one in the same header. A request
// without the header isn't checked (scripts, tests, the manual tests' curl commands).
//
// Not checked and not raised: what the browser does by itself while a stage runs (start, outputs, heartbeats, the end,
// the LLM calls), which the pipeline's own rules already guard (a running stage can't start again or be changed). A
// carried manual stage kept or dropped at its turn raises it without a check: it changes the pipeline, but nobody asked.

import type { Context, Hono, Next } from "hono";

export const VERSION_HEADER = "X-Project-Version";

export const STALE_MESSAGE = "This project was changed on another device or in another tab since this page loaded it. Reload to see the changes, then try again.";

type What = "checked" | "raised" | null;

// What a request does to the version: checked and raised (a person's change), only raised, or nothing.
async function whatOf(db: D1Database, method: string, rest: string[]): Promise<What> {
  // PATCH /api/projects/:id: the name, the run mode.
  if (rest.length === 0) return method === "PATCH" ? "checked" : null;
  // DELETE /api/projects/:pid/dropped/:id: a dropped stage's card dismissed.
  if (rest[0] === "dropped") return method === "DELETE" ? "checked" : null;
  if (rest[0] !== "stages" || rest.length !== 3) return null;
  const [, sid, action] = rest;
  if (method === "PUT" && action === "config") return "checked";
  if (method !== "POST") return null;
  if (["fix", "review", "human-review", "edit", "drop", "stop"].includes(action)) return "checked";
  if (action === "resolve") return "raised";
  // A manual stage's saves and its Finish are a person's; a running stage's outputs and end aren't.
  if (action === "outputs" || action === "finish") {
    const stage = await db.prepare("SELECT status FROM stages WHERE id = ?").bind(sid).first<{ status: string }>();
    return stage?.status === "wip" ? "checked" : null;
  }
  return null;
}

async function versionOf(db: D1Database, projectId: string): Promise<number | null> {
  return (await db.prepare("SELECT version FROM projects WHERE id = ? AND deleted_at IS NULL").bind(projectId).first<{ version: number }>())?.version ?? null;
}

export function versionRoutes(app: Hono<{ Bindings: Env }>) {
  const handle = async (c: Context<{ Bindings: Env }>, next: Next) => {
    const db = c.env.DB;
    const parts = new URL(c.req.url).pathname.split("/").filter(Boolean); // api, projects, :id, …
    const projectId = parts[2];
    const what = projectId ? await whatOf(db, c.req.method, parts.slice(3)) : null;
    if (what === "checked") {
      const sent = c.req.header(VERSION_HEADER);
      if (sent !== undefined) {
        const current = await versionOf(db, projectId);
        if (current !== null && String(current) !== sent.trim()) {
          c.header(VERSION_HEADER, String(current));
          return c.json({ error: STALE_MESSAGE, code: "stale_version" }, 409);
        }
      }
    }
    await next();
    if (what !== null && c.res.ok) {
      await db.prepare("UPDATE projects SET version = version + 1 WHERE id = ?").bind(projectId).run();
    }
    // Every answer about the project says its version, for the browser's next change.
    if (projectId && (what !== null || c.req.method === "GET")) {
      const current = await versionOf(db, projectId);
      if (current !== null) c.res.headers.set(VERSION_HEADER, String(current));
    }
  };
  // (Hono's "/api/projects/:id/*" matches "/api/projects/:id" itself too.)
  app.use("/api/projects/:id/*", handle);
}
