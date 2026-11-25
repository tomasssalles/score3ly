// Project names (docs/overview.md §4). The limit and the numbering are @score3ly/core's (names.ts), shared with model
// configs and the web app.

import { MAX_NAME_LENGTH } from "@score3ly/core";

// The base a new project's name is numbered from (`firstFreeName`, which cuts a base too long): the name given,
// trimmed, "Untitled" if nothing is left. An imported project's exported name.
export function nameBase(name: string): string {
  return name.trim() || "Untitled";
}

// The default project name: the file name without ".pdf", cut to the limit.
export function defaultName(filename: string): string {
  const trimmed = filename.trim();
  return nameBase(trimmed.toLowerCase().endsWith(".pdf") ? trimmed.slice(0, -4) : trimmed).slice(0, MAX_NAME_LENGTH).trim();
}
