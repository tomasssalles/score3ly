// What the app says about model configs on both sides (docs/llm.md, "Managing model configs").

// A config with exactly the values of another (all but the name) isn't created: the Worker refuses it, and the form
// finds it before asking anything else (decided 2026-11-17: no offer to rename it, which named odd names).
export function sameValuesMessage(existing: string): string {
  return `A config with these settings already exists: "${existing}". Two configs can't have the same settings; you can rename a config from its ⋮ menu.`;
}
