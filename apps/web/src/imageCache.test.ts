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

test("an image whose OPFS write failed is read back from memory", async () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  await cacheImage("key", png, "ab".repeat(32));
  const cached = await cachedImage("key", "ab".repeat(32));
  assert.ok(cached, "not found");
  assert.deepEqual(new Uint8Array(await cached.arrayBuffer()), png);
  assert.equal(await cacheUsage(), 4);
});
