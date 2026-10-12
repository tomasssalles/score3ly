// The device's image cache (DESIGN.md §8.6): computed images as PNG files in the origin private file system
// (OPFS), `cache/<key>.png`, the key being the hash of the image's recipe. Nothing is ever invalidated: an image
// that is no longer wanted is simply never asked for again. Where OPFS isn't available (some private windows), the
// images are kept in memory for as long as the page is open.
//
// Not built yet: the size limit and LRU eviction (§8.5).

const memory = new Map<string, Blob>();

async function folder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("cache", { create: true });
  } catch {
    return null;
  }
}

export async function cachedImage(key: string): Promise<Blob | null> {
  const dir = await folder();
  if (!dir) return memory.get(key) ?? null;
  try {
    return await (await dir.getFileHandle(`${key}.png`)).getFile();
  } catch {
    return null;
  }
}

export async function cacheImage(key: string, png: Uint8Array<ArrayBuffer>): Promise<void> {
  const dir = await folder();
  const blob = new Blob([png], { type: "image/png" });
  if (!dir) {
    memory.set(key, blob);
    return;
  }
  try {
    // Written under a temporary name and then renamed would be safer against a half-written file; OPFS's
    // writable stream only replaces the file when closed, which gives the same.
    const writable = await (await dir.getFileHandle(`${key}.png`, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    memory.set(key, blob);
  }
}
