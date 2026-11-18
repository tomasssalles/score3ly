// A call's place (docs/overview.md §12, "Each call records its place"): the item, in the outputs' form ("p3", "p3/s2",
// "" for the whole score), and the round, from 1. Recorded with the call, not part of its key. Calls made before it was
// recorded have the placeholders "?" and 0 until a one-time script fills them (scripts/fill-call-places.ts): an error
// wherever a place is read (`placeProblem`).

import type { CallPlace } from "@score3ly/core";

const MAX_ITEM_LENGTH = 100;

// The place a stage's request names, or what is wrong with it.
export function placeOf(body: Record<string, unknown>): CallPlace | string {
  const { item, round } = body;
  if (typeof item !== "string" || item.length > MAX_ITEM_LENGTH || item === PLACEHOLDER_ITEM) return "item must be the call's item";
  if (typeof round !== "number" || !Number.isInteger(round) || round < 1) return "round must be an integer from 1";
  return { item, round };
}

export const PLACEHOLDER_ITEM = "?";

// What is wrong with a recorded call's place: a placeholder left by the migration, which the one-time script fills.
export function placeProblem(call: Record<string, unknown>): string | null {
  return call.item === PLACEHOLDER_ITEM || call.round === 0
    ? `The LLM call ${String(call.id)} has no place (item and round) yet: run the one-time script apps/worker/scripts/fill-call-places.ts on this database.`
    : null;
}
