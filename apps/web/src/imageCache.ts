// The device's image cache (DESIGN.md §8.6): computed images as PNG files in the origin private file system
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
// Not built yet: the size limit and LRU eviction (§8.5).

const memory = new Map<string, Blob>();

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
  if (!dir) return memory.get(memoryName(name, pdf)) ?? null;
  try {
    return await (await dir.getFileHandle(name)).getFile();
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
    memory.set(memoryName(name, pdf), blob);
    return;
  }
  try {
    // Written under a temporary name and then renamed would be safer against a half-written file; OPFS's
    // writable stream only replaces the file when closed, which gives the same.
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    memory.set(memoryName(name, pdf), blob);
  }
}

// An image made from the PDF `pdf`.
export const cachedImage = (key: string, pdf: string): Promise<Blob | null> => cachedFile(`${key}.png`, pdf);

export const cacheImage = (key: string, png: Uint8Array<ArrayBuffer>, pdf: string): Promise<void> =>
  cacheFile(`${key}.png`, new Blob([png], { type: "image/png" }), pdf);

// Deletes every image made from a PDF, and what is kept with them (a deleted project's, §4).
export async function deleteCachedPdf(pdf: string): Promise<void> {
  for (const name of [...memory.keys()]) if (name.startsWith(`${pdfFolder(pdf)}/`)) memory.delete(name);
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

// An image's fingerprint (DESIGN.md §8.3), next to it: what it was when this device made it.
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
