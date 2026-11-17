// The items of a stage's outputs and calls (docs/database.md, "outputs"): "" for the whole score, "p3" for a page,
// "p3/s2" for the second system on page 3 (counted on its page, from 1). Written and read only here.

export function pageItem(page: number): string {
  return `p${page}`;
}

// The page of a page's item, or null for any other item.
export function pageOfItem(item: string): number | null {
  const match = /^p(\d+)$/.exec(item);
  return match ? Number(match[1]) : null;
}

export function systemItem(page: number, index: number): string {
  return `p${page}/s${index}`;
}

// The page and the system's index on it of a system's item, or null for any other item.
export function systemOfItem(item: string): { page: number; index: number } | null {
  const match = /^p(\d+)\/s(\d+)$/.exec(item);
  return match ? { page: Number(match[1]), index: Number(match[2]) } : null;
}

export type ItemKind = "whole" | "page" | "system";

// What an item is, by its shape alone (the statistics' run times; the Worker's SQL counts systems as items with "/").
export function itemKind(item: string): ItemKind {
  return item === "" ? "whole" : item.includes("/") ? "system" : "page";
}
