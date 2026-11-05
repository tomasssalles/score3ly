// A small JSON Schema validator for the subset the model list's schema uses (apps/worker/model-list/schema.json): type
// (one or several, "null" included), enum, required, properties, additionalProperties: false, items, pattern,
// minimum, minLength. Anything else in a schema is ignored. Returns the problems, each with its path.

export type Schema = {
  type?: string | string[];
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  pattern?: string;
  minimum?: number;
  minLength?: number;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

export function schemaProblems(schema: Schema, value: unknown, path = "$"): string[] {
  const problems: string[] = [];
  const type = typeOf(value);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const fits = types.includes(type) || (type === "integer" && types.includes("number"));
    if (!fits) return [`${path}: expected ${types.join(" or ")}, found ${type}`];
  }
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    problems.push(`${path}: expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}, found ${JSON.stringify(value)}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) problems.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) problems.push(`${path}: doesn't match ${schema.pattern}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: below ${schema.minimum}`);
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => problems.push(...schemaProblems(schema.items!, item, `${path}[${i}]`)));
  }
  if (type === "object") {
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in object)) problems.push(`${path}: missing ${key}`);
    for (const [key, child] of Object.entries(object)) {
      const sub = schema.properties?.[key];
      if (sub) problems.push(...schemaProblems(sub, child, `${path}.${key}`));
      else if (schema.additionalProperties === false) problems.push(`${path}: unexpected ${key}`);
    }
  }
  return problems;
}
