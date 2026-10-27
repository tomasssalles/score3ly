// The device's image cache (docs/images.md §8.6): computed images as PNG files in the origin private file system
// (OPFS), `cache/pdf-<sha256>/<key>.png`, the key being the hash of the image's recipe, in a folder per PDF so that
// deleting a project can delete its PDF's images (§4). Nothing is ever invalidated: an image
// that is no longer wanted is simply never asked for again. Where OPFS isn't available (some private windows), the
// images are kept in memory for as long as the page is open. The renderings of the Transcription (§6) are kept the
// same way, as SVG files.
//
// The browser is asked once per page load, at the first write, to keep the cache (`navigator.storage.persist()`,
// §8.5): Chromium decides by itself, Firefox asks the user. Either way the cache can still disappear; what is missing
// is made again.
//
// The cache has a size limit, a setting of this device (cacheLru.ts, §8.5): once a write takes it over, the least
// recently used files are deleted until it is back under 90% of it. OPFS keeps only write times, so the last use of
// each file is kept in an index (`cache/lru.json`), merged once per page load with a scan of the folder, which gives
// the sizes and catches what other tabs wrote. The memory fallback has a limit of its own.

import { cacheLimitMb, effectiveLimit, PRUNE_TO, toEvict, type CacheEntry } from "./cacheLru.ts";

// The memory fallback, least recently used first (a Map keeps its insertion order: a use moves an entry to the end).
const memory = new Map<string, Blob>();
const MEMORY_LIMIT = 200 * 1024 * 1024;

function remember(path: string, blob: Blob) {
  memory.delete(path);
  memory.set(path, blob);
  let total = [...memory.values()].reduce((sum, b) => sum + b.size, 0);
  for (const [oldest, old] of memory) {
    if (total <= MEMORY_LIMIT || oldest === path) break;
    memory.delete(oldest);
    total -= old.size;
  }
}

function recall(path: string): Blob | null {
  const blob = memory.get(path);
  if (!blob) return null;
  memory.delete(path);
  memory.set(path, blob);
  return blob;
}

// The cache's folder, or a PDF's folder in it.
async function folder(pdf?: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("cache", { create: true });
    return pdf ? await root.getDirectoryHandle(pdfFolder(pdf), { create: true }) : root;
  } catch {
    return null;
  }
}

const pdfFolder = (pdf: string) => `pdf-${pdf}`;

// A file's name in the memory fallback: with its folder.
const memoryName = (name: string, pdf?: string) => (pdf ? `${pdfFolder(pdf)}/${name}` : name);

async function cachedFile(name: string, pdf?: string): Promise<Blob | null> {
  const dir = await folder(pdf);
  if (!dir) return recall(memoryName(name, pdf));
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    void used(memoryName(name, pdf), file.size);
    return file;
  } catch {
    return null;
  }
}

let persistAsked = false;

function askToPersist() {
  if (persistAsked) return;
  persistAsked = true;
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return;
  storage
    .persisted()
    .then((already) => already || storage.persist())
    .catch(() => {}); // not kept, then: nothing breaks
}

async function cacheFile(name: string, blob: Blob, pdf?: string): Promise<void> {
  askToPersist();
  const dir = await folder(pdf);
  if (!dir) {
    remember(memoryName(name, pdf), blob);
    return;
  }
  try {
    // Written under a temporary name and then renamed would be safer against a half-written file; OPFS's
    // writable stream only replaces the file when closed, which gives the same.
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
    await used(memoryName(name, pdf), blob.size, true);
  } catch {
    remember(memoryName(name, pdf), blob);
  }
}

// --- The size limit (§8.5) ---------------------------------------------------------------------------------------

const INDEX = "lru.json";
const SAVE_DELAY = 2000;

// The cache's files (paths as `pdf-<sha256>/<name>`, or `<name>` at the top), loaded once per page load.
let index: Promise<Map<string, CacheEntry>> | null = null;

function loadIndex(): Promise<Map<string, CacheEntry>> {
  index ??= (async () => {
    const entries = new Map<string, CacheEntry>();
    const root = await folder();
    if (!root) return entries;
    let saved: Record<string, number> = {};
    try {
      saved = JSON.parse(await (await (await root.getFileHandle(INDEX)).getFile()).text());
    } catch {
      // No index yet, or a damaged one: the files' write times stand in.
    }
    const add = (path: string, file: File) =>
      entries.set(path, { path, size: file.size, used: Math.max(saved[path] ?? 0, file.lastModified) });
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === "file" && name !== INDEX) add(name, await (handle as FileSystemFileHandle).getFile());
      if (handle.kind === "directory") {
        for await (const [inner, file] of (handle as FileSystemDirectoryHandle).entries()) {
          if (file.kind === "file") add(`${name}/${inner}`, await (file as FileSystemFileHandle).getFile());
        }
      }
    }
    return entries;
  })().catch(() => new Map());
  return index;
}

let saving: ReturnType<typeof setTimeout> | null = null;

function saveSoon() {
  if (saving) return;
  saving = setTimeout(async () => {
    saving = null;
    const root = await folder();
    if (!root) return;
    const used = Object.fromEntries([...(await loadIndex()).values()].map((e) => [e.path, e.used]));
    try {
      const writable = await (await root.getFileHandle(INDEX, { create: true })).createWritable();
      await writable.write(JSON.stringify(used));
      await writable.close();
    } catch {
      // Not kept: the next page load falls back on the write times.
    }
  }, SAVE_DELAY);
}

// A file was read or written: it is the most recently used. After a write, the cache is pruned if it is too big.
async function used(path: string, size: number, written = false): Promise<void> {
  const entries = await loadIndex();
  entries.set(path, { path, size, used: Date.now() });
  saveSoon();
  if (written) await prune(path);
}

let pruning: Promise<void> = Promise.resolve();

function prune(keep: string): Promise<void> {
  pruning = pruning.then(async () => {
    const entries = await loadIndex();
    const limit = effectiveLimit(cacheLimitMb(), (await navigator.storage.estimate?.().catch(() => undefined))?.quota);
    const total = [...entries.values()].reduce((sum, e) => sum + e.size, 0);
    if (total <= limit) return;
    const root = await folder();
    if (!root) return;
    for (const entry of toEvict([...entries.values()], limit * PRUNE_TO, keep)) {
      const slash = entry.path.indexOf("/");
      try {
        if (slash < 0) await root.removeEntry(entry.path);
        else await (await root.getDirectoryHandle(entry.path.slice(0, slash))).removeEntry(entry.path.slice(slash + 1));
      } catch {
        // Gone already (another tab): nothing to do.
      }
      entries.delete(entry.path);
    }
    saveSoon();
  });
  return pruning;
}

// How much the cache takes on this device (Settings).
export async function cacheUsage(): Promise<number> {
  const inMemory = [...memory.values()].reduce((sum, b) => sum + b.size, 0);
  return [...(await loadIndex()).values()].reduce((sum, e) => sum + e.size, 0) + inMemory;
}

// After the limit was lowered: prune at once.
export function pruneNow(): Promise<void> {
  return prune("");
}

// An image made from the PDF `pdf`.
export const cachedImage = (key: string, pdf: string): Promise<Blob | null> => cachedFile(`${key}.png`, pdf);

export const cacheImage = (key: string, png: Uint8Array<ArrayBuffer>, pdf: string): Promise<void> =>
  cacheFile(`${key}.png`, new Blob([png], { type: "image/png" }), pdf);

// Deletes every image made from a PDF, and what is kept with them (a deleted project's, §4).
export async function deleteCachedPdf(pdf: string): Promise<void> {
  for (const name of [...memory.keys()]) if (name.startsWith(`${pdfFolder(pdf)}/`)) memory.delete(name);
  const entries = await loadIndex();
  for (const path of [...entries.keys()]) if (path.startsWith(`${pdfFolder(pdf)}/`)) entries.delete(path);
  saveSoon();
  try {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("cache", { create: true });
    await root.removeEntry(pdfFolder(pdf), { recursive: true });
  } catch {
    // Not there, or no OPFS: nothing to delete.
  }
}

export async function cachedSvg(key: string): Promise<string | null> {
  const blob = await cachedFile(`${key}.svg`);
  return blob ? blob.text() : null;
}

export const cacheSvg = (key: string, svg: string): Promise<void> => cacheFile(`${key}.svg`, new Blob([svg], { type: "image/svg+xml" }));

// An image's fingerprint (docs/images.md §8.3), next to it: what it was when this device made it.
export async function cachedJson(name: string, pdf: string): Promise<unknown | null> {
  const blob = await cachedFile(`${name}.json`, pdf);
  return blob ? JSON.parse(await blob.text()) : null;
}

export const cacheJson = (name: string, value: unknown, pdf: string): Promise<void> =>
  cacheFile(`${name}.json`, new Blob([JSON.stringify(value)], { type: "application/json" }), pdf);

// Several renderings at once (an engraving's pages), as one JSON file.
export async function cachedSvgs(key: string): Promise<string[] | null> {
  const blob = await cachedFile(`${key}.json`);
  return blob ? (JSON.parse(await blob.text()) as string[]) : null;
}

export const cacheSvgs = (key: string, svgs: string[]): Promise<void> => cacheFile(`${key}.json`, new Blob([JSON.stringify(svgs)], { type: "application/json" }));
