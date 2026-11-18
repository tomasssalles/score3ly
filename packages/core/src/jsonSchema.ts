// JSON Schema, the subset our schemas use (the LLM stages' answers, packages/prompts; the model list's files,
// apps/worker/model-list/schema.json), and one validator for it (docs/llm.md, "Structured output": JSON Schema with
// our own validator, no library). It checks: `anyOf`, `enum`, `type` (one or several, "null" included), `properties`
// with `required` and `additionalProperties: false`, `items`, `pattern`, `minimum`, `minLength`; anything else in a
// schema is ignored. Its messages may reach the user, as the reason an answer couldn't be used: "metadata[2].category
// isn't one of …".

export type JsonSchema = {
  type?: string | readonly string[];
  description?: string;
  enum?: readonly unknown[];
  anyOf?: readonly JsonSchema[];
  properties?: { readonly [key: string]: JsonSchema };
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  pattern?: string;
  minimum?: number;
  minLength?: number;
};

// Why something can't be used: an answer, a file.
export type Problem = { problem: string };

const TYPES: Record<string, [(value: unknown) => boolean, string]> = {
  object: [(v) => typeof v === "object" && v !== null && !Array.isArray(v), "an object"],
  array: [(v) => Array.isArray(v), "a list"],
  string: [(v) => typeof v === "string", "text"],
  integer: [(v) => Number.isInteger(v), "a whole number"],
  number: [(v) => typeof v === "number" && Number.isFinite(v), "a number"],
  boolean: [(v) => typeof v === "boolean", "true or false"],
  null: [(v) => v === null, "null"],
};

const child = (path: string, key: string) => (path ? `${path}.${key}` : key);

// Every problem of `value` against `schema`, in the order of the schema's properties and the list's items, each
// starting with its path (`path` names the value itself: "" for an answer, "$" for a file).
export function schemaProblems(schema: JsonSchema, value: unknown, path = ""): string[] {
  if (schema.anyOf) {
    const options = schema.anyOf.map((option) => schemaProblems(option, value, path));
    return options.some((p) => p.length === 0) ? [] : (options[0] ?? []);
  }
  if (schema.enum) return schema.enum.includes(value) ? [] : [`${path} isn't one of ${schema.enum.join(", ")}`];
  if (schema.type !== undefined) {
    const types = typeof schema.type === "string" ? [schema.type] : schema.type;
    const known = types.filter((t) => t in TYPES);
    if (known.length > 0 && !known.some((t) => TYPES[t][0](value))) return [`${path} isn't ${known.map((t) => TYPES[t][1]).join(" or ")}`];
  }
  const problems: string[] = [];
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) problems.push(`${path} is shorter than ${schema.minLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) problems.push(`${path} doesn't match ${schema.pattern}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) problems.push(`${path} is below ${schema.minimum}`);
  if (Array.isArray(value) && schema.items) {
    for (const [i, item] of value.entries()) problems.push(...schemaProblems(schema.items, item, `${path}[${i}]`));
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];
    // A required property that is missing gets its type's message ("… isn't text").
    for (const [key, sub] of Object.entries(properties)) {
      if (key in object || required.includes(key)) problems.push(...schemaProblems(sub, object[key], child(path, key)));
    }
    for (const key of required) if (!(key in properties) && !(key in object)) problems.push(`${path} has no ${key}`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) if (!(key in properties)) problems.push(`${path} has an unexpected ${key}`);
    }
  }
  return problems;
}

// The first problem, or null.
export const schemaProblem = (schema: JsonSchema, value: unknown, path = ""): string | null => schemaProblems(schema, value, path)[0] ?? null;
