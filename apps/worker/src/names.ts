// Project names (docs/overview.md §4). Kept out of index.ts: a Worker's entry module may only export handlers. The
// limit and the numbering are @score3ly/core's (names.ts), shared with model configs and the web app.

import { MAX_NAME_LENGTH } from "@score3ly/core";

// The default project name: the file name without ".pdf".
export function defaultName(filename: string): string {
  const trimmed = filename.trim();
  const stem = (trimmed.toLowerCase().endsWith(".pdf") ? trimmed.slice(0, -4) : trimmed).trim();
  return (stem || "Untitled").slice(0, MAX_NAME_LENGTH).trim();
}
