// Keys from content (docs/overview.md §5.2, docs/images.md §8.6): the SHA-256 of canonical JSON, so the same content always gives the same
// key, whichever app computes it.

// The SHA-256 of some bytes, in lowercase hex (WebCrypto: browsers, Workers, Node).
export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Whether a value is a SHA-256 as `sha256Hex` writes it: every content key, recipe key and hash the app stores.
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

// What JSON leaves out of an object and writes as null in an array.
const unwritable = (value: unknown) => value === undefined || typeof value === "function" || typeof value === "symbol";

// JSON with the keys of every object sorted, and no spaces; as JSON.stringify otherwise: undefined values (and
// functions) left out of objects, null in arrays. For plain JSON values only: `toJSON`, Dates, Maps and typed arrays
// aren't what JSON.stringify makes of them. A value JSON can't write at all (undefined) is refused.
export function canonicalJson(value: unknown): string {
  if (unwritable(value)) throw new TypeError(`canonicalJson: ${typeof value} is not a JSON value`);
  return write(value);
}

function write(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (unwritable(v) ? "null" : write(v))).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => !unwritable(v))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${write(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function keyOf(value: unknown): Promise<string> {
  return sha256Hex(new TextEncoder().encode(canonicalJson(value)));
}

// A value as it is stored and read back (its canonical JSON parsed): keys sorted, undefined left out, so that what a
// stage keeps in memory equals what a later run reads.
export function normalized<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

// What of a model config goes into stage and request keys (§5.2): its provider, model and effort. Not its name,
// place, parameters or secrets, which don't change the answer.
export function modelKeyOf<E>(config: { provider: string; model: string; effort: E }): { provider: string; model: string; effort: E } {
  return { provider: config.provider, model: config.model, effort: config.effort };
}
