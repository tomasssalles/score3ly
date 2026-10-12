// Cache keys (DESIGN.md §5.2, §8.6): the SHA-256 of canonical JSON, so the same content always gives the same key.

import { sha256Hex } from "./sha256.ts";

// JSON with the keys of every object sorted, and no spaces.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function keyOf(value: unknown): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJson(value)));
}
