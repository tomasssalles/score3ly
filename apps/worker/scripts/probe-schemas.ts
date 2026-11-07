// Asks Anthropic whether it accepts the stages' JSON schemas for schema-constrained output (docs/llm.md, "Claude's
// limit on schemas"), with a short text-only request per schema and variant:
//
//   ANTHROPIC_API_KEY=... npm run llm:probe-schemas -w apps/worker -- [model] [name prefix]
//
// The model defaults to claude-sonnet-5-5 (the limit doesn't depend on the model). A schema that is refused costs
// nothing; one that is accepted costs its prompt (the schema is part of it, about 0.5k to 3k tokens) and 64 output
// tokens, a fraction of a cent on Sonnet.

import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_PAGE_SCHEMA, ANALYZE_SCORE_SCHEMA } from "../../../packages/prompts/src/analyze.ts";
import { APPLY_REVIEW_SCHEMA } from "../../../packages/prompts/src/applyReview.ts";
import { EXTRACT_SCHEMA } from "../../../packages/prompts/src/extract.ts";
import { LAYOUT_SCHEMA } from "../../../packages/prompts/src/layout.ts";
import { REVIEW_SCHEMA } from "../../../packages/prompts/src/review.ts";

type Schema = any;

const copy = (s: Schema): Schema => JSON.parse(JSON.stringify(s));

// The schema with every object that `f` replaces replaced, recursively.
function rewrite(s: Schema, f: (o: Schema) => Schema | undefined): Schema {
  if (Array.isArray(s)) return s.map((x) => rewrite(x, f));
  if (!s || typeof s !== "object") return s;
  const replaced = f(s);
  if (replaced !== undefined) return rewrite(replaced, f);
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, rewrite(v, f)]));
}
const withoutEnums = (s: Schema) =>
  rewrite(s, (o) => {
    if (!("enum" in o)) return undefined;
    const { enum: _, ...rest } = o;
    return rest;
  });
const withoutAnyOf = (s: Schema) => rewrite(s, (o) => (o.anyOf ? o.anyOf[0] : undefined));

// Every object schema that occurs more than once, moved into $defs and referred to by $ref.
function withDefs(s: Schema): Schema {
  const counts = new Map<string, number>();
  const count = (x: Schema) => {
    if (Array.isArray(x)) return x.forEach(count);
    if (!x || typeof x !== "object") return;
    if (x.type === "object") counts.set(JSON.stringify(x), (counts.get(JSON.stringify(x)) ?? 0) + 1);
    Object.values(x).forEach(count);
  };
  count(s);
  const names = new Map([...counts].filter(([, n]) => n > 1).map(([key], i) => [key, `d${i}`]));
  const defs: Record<string, Schema> = {};
  const replace = (x: Schema, top: boolean): Schema => {
    if (Array.isArray(x)) return x.map((y) => replace(y, false));
    if (!x || typeof x !== "object") return x;
    const name = names.get(JSON.stringify(x));
    if (!top && name) {
      defs[name] ??= replace(x, true);
      return { $ref: `#/$defs/${name}` };
    }
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, replace(v, false)]));
  };
  return { ...replace(s, true), $defs: defs };
}

// An object schema with only some of its properties.
const only = (s: Schema, keys: string[]): Schema => ({
  ...s,
  properties: Object.fromEntries(keys.map((k) => [k, s.properties[k]])),
  required: keys,
});

const page = copy(ANALYZE_PAGE_SCHEMA);
const score = copy(ANALYZE_SCORE_SCHEMA);
const variants: [string, Schema][] = [
  ["layout", copy(LAYOUT_SCHEMA)],
  ["review", copy(REVIEW_SCHEMA)],
  ["apply_review", copy(APPLY_REVIEW_SCHEMA)],
  ["extract", copy(EXTRACT_SCHEMA)],
  ["analyze page", page],
  ["analyze page, no enums", withoutEnums(page)],
  ["analyze page, no anyOf", withoutAnyOf(page)],
  ["analyze page, metadata only", only(page, ["metadata"])],
  ["analyze page, observations only", only(page, ["observations"])],
  ["analyze score", score],
  ["analyze score, $defs", withDefs(score)],
  ["analyze score, no enums", withoutEnums(score)],
  ["analyze score, no anyOf", withoutAnyOf(score)],
  ["analyze score, without additions", only(score, ["metadata", "corrections", "removals", "score"])],
];

const [model = "claude-sonnet-5-5", prefix = ""] = process.argv.slice(2);
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Set ANTHROPIC_API_KEY.");
  process.exit(1);
}
const client = new Anthropic({ apiKey, maxRetries: 0 });

for (const [name, schema] of variants) {
  if (!name.startsWith(prefix)) continue;
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 64,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: "Reply with any valid JSON." }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    console.log(`${name}: accepted (${response.usage.input_tokens} input tokens)`);
  } catch (e) {
    const error = e as { status?: number; error?: { error?: { message?: string } }; message: string };
    console.log(`${name}: ${error.status} ${error.error?.error?.message ?? error.message}`);
  }
}
