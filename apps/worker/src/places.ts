// A call's place (docs/overview.md §12, "Each call records its place"): the item, in the outputs' form ("p3", "p3/s2",
// "" for the whole score), and the round, from 1. Recorded with the call, not part of its key, and required (the code
// review's E6, the owner's dec. 17: migration 0009 refuses a new row without one, the import a file without them).
//
// Calls made before places were recorded got the placeholders "?" and 0 (migration 0004), which a one-time script
// filled where it could tell the place (removed by the code review's batch 32). A database may still hold calls it
// couldn't place: they are kept as they are, and a project that has one isn't exported (`placeProblem`).

import type { CallPlace } from "@score3ly/core";

const MAX_ITEM_LENGTH = 100;

// The placeholder item of migration 0004, which no call can be given.
const PLACEHOLDER_ITEM = "?";

// The place a stage's request names (or an imported call's row), or what is wrong with it.
export function placeOf(body: Record<string, unknown>): CallPlace | string {
  const { item, round } = body;
  if (typeof item !== "string" || item.length > MAX_ITEM_LENGTH || item === PLACEHOLDER_ITEM) return "item must be the call's item";
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1) return "round must be an integer from 1";
  return { item, round };
}

// What is wrong with a recorded call that still has the placeholders: a call the one-time script couldn't place.
export function placeProblem(call: Record<string, unknown>): string | null {
  return call.item === PLACEHOLDER_ITEM || call.round === 0
    ? `the LLM call ${String(call.id)} was recorded before calls had a place (an item and a round), and its place couldn't be told afterwards`
    : null;
}
