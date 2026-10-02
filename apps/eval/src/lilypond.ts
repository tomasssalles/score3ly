// Helpers for LilyPond's console output.

// LilyPond reports warnings as "<file>:<line>:<column>: warning: <message>" (or without location).
export function warningLines(output: string): string[] {
  return output.split("\n").filter((line) => line.includes("warning:"));
}
