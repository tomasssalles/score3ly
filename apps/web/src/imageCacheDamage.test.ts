import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePng } from "@score3ly/imaging";

// A device whose OPFS works: files kept in maps, so that a test can damage one.
class Folder {
  files = new Map<string, Blob>();
  folders = new Map<string, Folder>();
  async getDirectoryHandle(name: string) {
    if (!this.folders.has(name)) this.folders.set(name, new Folder());
    return this.folders.get(name)!;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new DOMException(`${name} not found`, "NotFoundError");
    return {
      kind: "file",
      getFile: async () => new File([this.files.get(name)!], name),
      createWritable: async () => {
        let written: Blob = new Blob([]);
        return {
          write: async (blob: Blob | string) => {
            written = typeof blob === "string" ? new Blob([blob]) : blob;
          },
          close: async () => {
            this.files.set(name, written);
          },
        };
      },
    };
  }
  async removeEntry(name: string) {
    if (!this.files.delete(name) && !this.folders.delete(name)) throw new DOMException(`${name} not found`, "NotFoundError");
  }
  async *entries() {}
}

const root = new Folder();
Object.defineProperty(globalThis.navigator, "storage", { value: { getDirectory: async () => root }, configurable: true });
const { cachedImage, cacheImage, cachedJson, cacheJson } = await import("./imageCache.ts");

const pdf = "ef".repeat(32);
const inPdf = async () => (await (await root.getDirectoryHandle("cache")).getDirectoryHandle(`pdf-${pdf}`)) as Folder;

test("a cached PNG that isn't whole is deleted, and missing for whoever asks: it is made again", async () => {
  const png = await encodePng({ width: 3, height: 2, data: new Uint8ClampedArray(24).fill(200) });
  await cacheImage("whole", png, pdf);
  assert.ok(await cachedImage("whole", pdf));
  await cacheImage("cut", png.subarray(0, png.length - 5).slice(), pdf);
  assert.equal(await cachedImage("cut", pdf), null);
  assert.equal((await inPdf()).files.has("cut.png"), false);
  // Made again, it is found.
  await cacheImage("cut", png, pdf);
  assert.ok(await cachedImage("cut", pdf));
});

test("a cached JSON file that can't be read is deleted and missing", async () => {
  await cacheJson("kept.fingerprint", { version: 1 }, pdf);
  assert.deepEqual(await cachedJson("kept.fingerprint", pdf), { version: 1 });
  (await inPdf()).files.set("bad.fingerprint.json", new Blob(['{"version": 1']));
  assert.equal(await cachedJson("bad.fingerprint", pdf), null);
  assert.equal((await inPdf()).files.has("bad.fingerprint.json"), false);
});
