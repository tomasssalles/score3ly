import { test } from "node:test";
import assert from "node:assert/strict";

// A device whose OPFS is there but refuses writes (full, or a quota): the image is kept in memory instead.
class Folder {
  folders = new Map<string, Folder>();
  async getDirectoryHandle(name: string) {
    if (!this.folders.has(name)) this.folders.set(name, new Folder());
    return this.folders.get(name)!;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!options?.create) throw new DOMException(`${name} not found`, "NotFoundError");
    return {
      createWritable: async () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    };
  }
  async *entries() {}
}

const root = new Folder();
Object.defineProperty(globalThis.navigator, "storage", { value: { getDirectory: async () => root }, configurable: true });
const { cachedImage, cacheImage, cacheUsage } = await import("./imageCache.ts");

// Bytes that look like a whole PNG (its signature and IHDR first, its IEND chunk last), `size` long.
function pngLike(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  bytes.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], size - 12);
  return bytes;
}

test("an image whose OPFS write failed is read back from memory", async () => {
  const png = pngLike(40);
  await cacheImage("key", png, "ab".repeat(32));
  const cached = await cachedImage("key", "ab".repeat(32));
  assert.ok(cached, "not found");
  assert.deepEqual(new Uint8Array(await cached.arrayBuffer()), png);
  assert.equal(await cacheUsage(), 40);
});

test("the memory fallback keeps at most 200 MB, the least recently used going first", async () => {
  const pdf = "cd".repeat(32);
  const mb = (n: number) => pngLike(n * 1024 * 1024);
  await cacheImage("a", mb(90), pdf);
  await cacheImage("b", mb(90), pdf);
  assert.ok(await cachedImage("a", pdf)); // a is used again: b is now the least recently used
  await cacheImage("c", mb(90), pdf);
  assert.equal(await cachedImage("b", pdf), null);
  assert.ok(await cachedImage("a", pdf));
  assert.ok(await cachedImage("c", pdf));
  // Over the limit with the image just written alone: it stays.
  await cacheImage("d", mb(210), pdf);
  assert.ok(await cachedImage("d", pdf));
  assert.equal(await cachedImage("a", pdf), null);
  assert.equal(await cachedImage("c", pdf), null);
});
