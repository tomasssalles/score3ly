// Helpers for LilyPond's console output.

// Warnings not worth reporting after a successful compilation.
export const IGNORED_WARNINGS: RegExp[] = [/.*: may not find good beam slope$/];

// LilyPond reports warnings as "<file>:<line>:<column>: warning: <message>" (or without location).
export function warningLines(output: string, ignored: RegExp[] = IGNORED_WARNINGS): string[] {
  return output
    .split("\n")
    .filter((line) => line.includes("warning:"))
    .filter((line) => !ignored.some((pattern) => pattern.test(line)));
}
