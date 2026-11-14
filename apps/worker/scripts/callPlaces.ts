// Fills in the place (item and round) of the LLM calls made before migration 0004 recorded it (docs/overview.md §12,
// "Each call records its place"), from what the database and the stored requests say; run once by
// fill-call-places.ts. Working the place out from a request is only safe for the requests as they are today, hence once,
// not in the replay.
// - Calls of no stage (a config's Test): "" and 1.
// - The round: the number of the model's own earlier answers in the request's conversation, plus one (`layout`'s
//   rounds; every other step has one).
// - The item: that of the outputs naming the call (an output records the call its content came from); otherwise that
//   of another call whose request starts with the same first message, images named by their recipe keys: the same
//   page or system, asked again (a retry) or further (`layout`'s later rounds).
// - A call whose request is gone (a deleted project's): the outputs' item, and round 1, except in `layout`.
// Calls whose place can't be told keep the placeholders and are listed, for a person to decide.

import { canonicalJson } from "@score3ly/core";

const PLACEHOLDER_ITEM = "?";

type CallRow = { id: string; stage_id: string | null; request_sha256: string | null; item: string; round: number; status: string; started_at: string; step: string | null };
type StoredRequest = { messages?: { role: string; content: Record<string, unknown>[] }[] };

export type Unplaced = { id: string; step: string | null; status: string; startedAt: string; reason: string };
export type Filled = { filled: number; unplaced: Unplaced[] };

export async function fillCallPlaces(db: D1Database, bucket: R2Bucket, log: (line: string) => void = () => {}): Promise<Filled> {
  const { results: calls } = await db
    .prepare("SELECT c.id, c.stage_id, c.request_sha256, c.item, c.round, c.status, c.started_at, s.step FROM llm_calls c LEFT JOIN stages s ON s.id = c.stage_id")
    .all<CallRow>();
  const todo = calls.filter((c) => c.item === PLACEHOLDER_ITEM || c.round === 0);
  log(`${calls.length} calls, ${todo.length} without a place.`);
  if (todo.length === 0) return { filled: 0, unplaced: [] };

  // The items the outputs name their calls by; a call named by outputs of different items has none it can be given.
  const { results: named } = await db.prepare("SELECT call_id, item FROM outputs WHERE call_id IS NOT NULL").all<{ call_id: string; item: string }>();
  const itemsOf = new Map<string, Set<string>>();
  for (const n of named) itemsOf.set(n.call_id, (itemsOf.get(n.call_id) ?? new Set()).add(n.item));

  // Each call's request: its round and its first message (images by their recipe keys).
  const requests = new Map<string, { round: number; first: string }>();
  let fetched = 0;
  for (const c of calls) {
    if (!c.request_sha256 || c.stage_id === null) continue;
    const object = await bucket.get(`content/${c.request_sha256}`);
    if (++fetched % 50 === 0) log(`${fetched} requests read…`);
    if (!object) continue;
    const request = (await object.json()) as StoredRequest;
    const messages = request.messages ?? [];
    if (messages.length === 0) continue;
    requests.set(c.id, { round: messages.filter((m) => m.role === "assistant").length + 1, first: firstMessageKey(messages[0]) });
  }

  // Items by first message: from the calls whose item is known (recorded, or named by outputs).
  const knownItem = (c: CallRow): string | null => {
    if (c.item !== PLACEHOLDER_ITEM) return c.item;
    const items = itemsOf.get(c.id);
    return items?.size === 1 ? [...items][0] : null;
  };
  const byFirst = new Map<string, Set<string>>();
  for (const c of calls) {
    const item = knownItem(c);
    const request = requests.get(c.id);
    if (item !== null && request) byFirst.set(request.first, (byFirst.get(request.first) ?? new Set()).add(item));
  }

  const updates: { id: string; item: string; round: number }[] = [];
  const unplaced: Unplaced[] = [];
  for (const c of todo) {
    const unknown = (reason: string) => unplaced.push({ id: c.id, step: c.step, status: c.status, startedAt: c.started_at, reason });
    if (c.stage_id === null) {
      updates.push({ id: c.id, item: "", round: 1 });
      continue;
    }
    const request = requests.get(c.id);
    if (!request) {
      // No request to read (its project was deleted, which drops it): the outputs still say the item, and only
      // `layout` has more than one round.
      const item = knownItem(c);
      if (item !== null && c.step !== "layout") updates.push({ id: c.id, item, round: 1 });
      else unknown(c.request_sha256 ? "its stored request is missing" : "it has no stored request (its project was deleted), and no output says its place");
      continue;
    }
    let item = knownItem(c);
    if (item === null) {
      if ((itemsOf.get(c.id)?.size ?? 0) > 1) {
        unknown(`outputs of different items name it: ${[...itemsOf.get(c.id)!].join(", ")}`);
        continue;
      }
      const items = byFirst.get(request.first);
      if (!items || items.size !== 1) {
        unknown(items ? `requests like it belong to different items: ${[...items].join(", ")}` : "no output names it, nor any call that asked the same");
        continue;
      }
      item = [...items][0];
    }
    updates.push({ id: c.id, item, round: c.round === 0 ? request.round : c.round });
  }

  // D1 takes at most so many statements per batch.
  for (let i = 0; i < updates.length; i += 50) {
    await db.batch(updates.slice(i, i + 50).map((u) => db.prepare("UPDATE llm_calls SET item = ?, round = ? WHERE id = ?").bind(u.item, u.round, u.id)));
  }
  log(`${updates.length} filled, ${unplaced.length} left without a place.`);
  return { filled: updates.length, unplaced };
}

// A request's first message, comparable across runs and devices: images by their recipe keys only (an image made
// again has the same recipe, maybe not the same bytes), text as it is.
function firstMessageKey(message: { role: string; content: Record<string, unknown>[] }): string {
  return canonicalJson({
    role: message.role,
    content: message.content.map((c) => (c.type === "image" ? { type: "image", recipeKey: c.recipeKey } : { type: c.type, text: c.text })),
  });
}
