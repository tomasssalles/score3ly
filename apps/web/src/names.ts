// Project names, as the Worker checks them (apps/worker/src/names.ts, DESIGN.md §4).

export const MAX_NAME_LENGTH = 200;

// Why a new name can't be saved yet, or null if it can. The Worker trims names, so this does too.
// Uniqueness is only known to the Worker.
export function nameProblem(name: string, currentName: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "The name can't be empty.";
  if (trimmed.length > MAX_NAME_LENGTH) return `The name can be at most ${MAX_NAME_LENGTH} characters long.`;
  if (trimmed === currentName) return "That is the current name.";
  return null;
}
