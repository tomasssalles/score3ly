// Asks Anthropic whether it accepts the stages' JSON schemas for schema-constrained output (docs/llm.md, "Claude's
// limit on schemas"), with a short text-only request per schema, built by the adapter as every call is (`toParams`):
//
//   ANTHROPIC_API_KEY=... npm run llm:probe-schemas -w apps/worker -- [model] [name prefix]
//
// The model defaults to claude-sonnet-5-5 (the limit doesn't depend on the model). A schema that is refused costs
// nothing; one that is accepted costs its prompt (the schema is part of it, about 0.5k to 3k tokens) and 64 output
// tokens, a fraction of a cent on Sonnet. Run it when a schema grows.

import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import type { JsonSchema } from "@score3ly/core";
import { ANALYZE_PAGE_SCHEMA, ANALYZE_SCORE_SCHEMA, APPLY_REVIEW_SCHEMA, EXTRACT_SCHEMA, LAYOUT_SCHEMA, REVIEW_SCHEMA } from "@score3ly/prompts";
import { toParams } from "../src/llm/anthropic.ts";

const SCHEMAS: [string, JsonSchema][] = [
  ["layout", LAYOUT_SCHEMA],
  ["analyze page", ANALYZE_PAGE_SCHEMA],
  ["analyze score", ANALYZE_SCORE_SCHEMA],
  ["extract", EXTRACT_SCHEMA],
  ["review", REVIEW_SCHEMA],
  ["apply_review", APPLY_REVIEW_SCHEMA],
];

const positionals = parseArgs({ allowPositionals: true }).positionals;
if (positionals.length > 2) {
  console.error("Usage: probe-schemas.ts [model] [prefix]");
  process.exit(1);
}
const [model = "claude-sonnet-5-5", prefix = ""] = positionals;
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Set ANTHROPIC_API_KEY.");
  process.exit(1);
}
const client = new Anthropic({ apiKey, maxRetries: 0 });

for (const [name, schema] of SCHEMAS) {
  if (!name.startsWith(prefix)) continue;
  const params = toParams({
    model,
    messages: [{ role: "user", content: [{ type: "text", text: "Reply with any valid JSON." }] }],
    maxOutputTokens: 64,
    effort: "low",
    jsonSchema: schema,
  });
  try {
    const response = await client.messages.create({ ...params, stream: false });
    console.log(`${name}: accepted (${response.usage.input_tokens} input tokens)`);
  } catch (e) {
    const error = e as { status?: number; error?: { error?: { message?: string } }; message: string };
    console.log(`${name}: ${error.status} ${error.error?.error?.message ?? error.message}`);
  }
}
