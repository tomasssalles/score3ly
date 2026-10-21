// The device's image cache (DESIGN.md §8.6): computed images as PNG files in the origin private file system
// (OPFS), `cache/<key>.png`, the key being the hash of the image's recipe. Nothing is ever invalidated: an image
// that is no longer wanted is simply never asked for again. Where OPFS isn't available (some private windows), the
// images are kept in memory for as long as the page is open. The renderings of the Transcription (§6) are kept the
// same way, as SVG files.
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

async function cachedFile(name: string): Promise<Blob | null> {
  const dir = await folder();
  if (!dir) return memory.get(name) ?? null;
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

async function cacheFile(name: string, blob: Blob): Promise<void> {
  const dir = await folder();
  if (!dir) {
    memory.set(name, blob);
    return;
  }
  try {
    // Written under a temporary name and then renamed would be safer against a half-written file; OPFS's
    // writable stream only replaces the file when closed, which gives the same.
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    memory.set(name, blob);
  }
}

export const cachedImage = (key: string): Promise<Blob | null> => cachedFile(`${key}.png`);

export const cacheImage = (key: string, png: Uint8Array<ArrayBuffer>): Promise<void> => cacheFile(`${key}.png`, new Blob([png], { type: "image/png" }));

export async function cachedSvg(key: string): Promise<string | null> {
  const blob = await cachedFile(`${key}.svg`);
  return blob ? blob.text() : null;
}

export const cacheSvg = (key: string, svg: string): Promise<void> => cacheFile(`${key}.svg`, new Blob([svg], { type: "image/svg+xml" }));

// Several renderings at once (an engraving's pages), as one JSON file.
export async function cachedSvgs(key: string): Promise<string[] | null> {
  const blob = await cachedFile(`${key}.json`);
  return blob ? (JSON.parse(await blob.text()) as string[]) : null;
}

export const cacheSvgs = (key: string, svgs: string[]): Promise<void> => cacheFile(`${key}.json`, new Blob([JSON.stringify(svgs)], { type: "application/json" }));
