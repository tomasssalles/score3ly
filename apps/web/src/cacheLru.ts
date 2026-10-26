// The image cache's size limit (DESIGN.md §8.5, §8.6): which files go when the cache is over its limit, the least
// recently used first, and the limit itself, a setting of this device.

export type CacheEntry = { path: string; size: number; used: number }; // used: ms since the epoch, last read or write

// The files to delete, oldest use first, so that what is left takes at most `target` bytes. `keep` (a file just
// written or read) is never among them.
export function toEvict(entries: CacheEntry[], target: number, keep?: string): CacheEntry[] {
  let total = entries.reduce((sum, e) => sum + e.size, 0);
  const evicted: CacheEntry[] = [];
  for (const entry of [...entries].sort((a, b) => a.used - b.used)) {
    if (total <= target) break;
    if (entry.path === keep) continue;
    evicted.push(entry);
    total -= entry.size;
  }
  return evicted;
}

// Once over the limit, the cache is brought down to this share of it, so that it isn't pruned at every write.
export const PRUNE_TO = 0.9;

const MB = 1024 * 1024;

// The limits the user can pick, in MB; the default is 1 GB.
export const CACHE_LIMITS_MB = [250, 500, 1000, 2000, 5000];
const DEFAULT_LIMIT_MB = 1000;
const KEY = "score3ly.imageCacheMB";

export function cacheLimitMb(): number {
  try {
    const stored = Number(localStorage.getItem(KEY));
    if (stored > 0) return stored;
  } catch {
    // No storage: the default.
  }
  return DEFAULT_LIMIT_MB;
}

export function setCacheLimitMb(mb: number) {
  try {
    if (mb === DEFAULT_LIMIT_MB) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(mb));
  } catch {
    // Not kept: it applies until the page is reloaded.
  }
}

// The limit in bytes: the chosen one, but never more than 80% of what the browser lets this site store.
export function effectiveLimit(limitMb: number, quota: number | undefined): number {
  const chosen = limitMb * MB;
  return quota && quota > 0 ? Math.min(chosen, Math.floor(quota * 0.8)) : chosen;
}

// "120 MB", "1.4 GB".
export function formatSize(bytes: number): string {
  return bytes >= 1000 * MB ? `${(bytes / (1000 * MB)).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`;
}
