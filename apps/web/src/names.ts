// Project names, as the Worker checks them (the rule is @score3ly/core's, names.ts; docs/overview.md §4).

import { MAX_NAME_LENGTH, nameTooLong } from "@score3ly/core";

export { MAX_NAME_LENGTH };

// Why a new name can't be saved yet, or null if it can. The Worker trims names, so this does too.
// Uniqueness is only known to the Worker.
export function nameProblem(name: string, currentName: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "The name can't be empty.";
  if (nameTooLong(trimmed)) return `The name can be at most ${MAX_NAME_LENGTH} characters long.`;
  if (trimmed === currentName) return "That is the current name.";
  return null;
}
