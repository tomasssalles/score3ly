// Sends one image and a question to a vision LLM, with real keys, to try the adapters (src/llm) by hand, made as the
// Worker makes them (`createAdapter`, by the app's provider names):
//
//   ANTHROPIC_API_KEY=... npm run llm:try -w apps/worker -- anthropic claude-opus-5-5 page.png "How many systems?"
//   GEMINI_API_KEY=...    npm run llm:try -w apps/worker -- ai-studio gemini-3-pro page.jpg "How many systems?"
//   VERTEX_SERVICE_ACCOUNT=key.json VERTEX_REGION=global \
//                         npm run llm:try -w apps/worker -- vertex gemini-3.1-pro-preview page.png "How many systems?"
//
//   OPENROUTER_API_KEY=... OPENROUTER_REGION=eu \
//                         npm run llm:try -w apps/worker -- openrouter anthropic/claude-opus-5.5 page.png "..."
//
//   BEDROCK_API_KEY=... BEDROCK_REGION=eu-central-1 \
//                         npm run llm:try -w apps/worker -- bedrock eu.anthropic.claude-opus-5-5 page.png "..."
//
// For Gemini on Vertex AI, VERTEX_SERVICE_ACCOUNT is the path of a service account's key file (JSON), VERTEX_REGION the region
// ("eu" if left out), and VERTEX_PROJECT the project (the key file's if left out). For Bedrock, BEDROCK_API_KEY is a
// Bedrock API key, or else AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY an access key pair; BEDROCK_REGION is the
// region ("eu-central-1" if left out). For OpenRouter, OPENROUTER_REGION "eu" sends to its EU host (a Business account),
// everywhere if left out; the answer's reported cost and who ran it are printed with the usage. The model is the
// provider's own string for it, as sent (on Bedrock with its routing's prefix). Up to 64,000 output tokens.
//
// Add --json to ask for {"answer": string} through the provider's schema-constrained output.

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PROVIDERS as ALL_PROVIDERS, type Provider } from "@score3ly/core";
import { type AdapterSettings, createAdapter, type LlmImage } from "../src/llm/index.ts";

// The app's providers but the fake ones, which need no trying.
type TriedProvider = Exclude<Provider, "fake" | "fake-dev">;
const PROVIDERS = ALL_PROVIDERS.filter((p): p is TriedProvider => p !== "fake" && p !== "fake-dev");

const args = parseArgs({ options: { json: { type: "boolean", default: false } }, allowPositionals: true });
const json = args.values.json;
const [provider, model, imagePath, prompt] = args.positionals as [TriedProvider, string, string, string];
if (args.positionals.length !== 4 || !PROVIDERS.includes(provider) || !model || !imagePath || !prompt) {
  console.error(`Usage: try-llm.ts <${PROVIDERS.join("|")}> <model> <image> <prompt> [--json]`);
  process.exit(1);
}

// Relative to where the command was typed (npm runs the script in this package's folder).
const userPath = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name}.`);
    process.exit(1);
  }
  return value;
}

// The secrets and the place each provider takes, from the environment. The family only picks the adapter; on
// OpenRouter, which takes both, it doesn't matter which.
function settings(): AdapterSettings {
  const family = provider === "ai-studio" || provider === "vertex" ? "gemini" : "claude";
  const base = { provider, family, region: "", project: null } as const;
  switch (provider) {
    case "anthropic":
      return { ...base, secrets: { apiKey: required("ANTHROPIC_API_KEY") } };
    case "ai-studio":
      return { ...base, secrets: { apiKey: required("GEMINI_API_KEY") } };
    case "openrouter":
      return { ...base, region: process.env.OPENROUTER_REGION ?? "", secrets: { apiKey: required("OPENROUTER_API_KEY") } };
    case "vertex":
      return {
        ...base,
        region: process.env.VERTEX_REGION ?? "eu",
        project: process.env.VERTEX_PROJECT ?? null,
        secrets: { serviceAccount: readFileSync(userPath(required("VERTEX_SERVICE_ACCOUNT")), "utf8") },
      };
    case "bedrock": {
      const apiKey = process.env.BEDROCK_API_KEY;
      const secrets: Record<string, string> = apiKey ? { apiKey } : { accessKeyId: required("AWS_ACCESS_KEY_ID"), secretAccessKey: required("AWS_SECRET_ACCESS_KEY") };
      return { ...base, region: process.env.BEDROCK_REGION ?? "eu-central-1", secrets };
    }
  }
}

const mediaTypes: Record<string, LlmImage["mediaType"]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const mediaType = mediaTypes[extname(imagePath).toLowerCase()];
if (!mediaType) {
  console.error("The image must be a PNG, JPEG or WebP file.");
  process.exit(1);
}

const imageFile = userPath(imagePath);

const started = Date.now();
const response = await createAdapter(settings())!.send({
  model,
  maxOutputTokens: 64_000,
  messages: [
    {
      role: "user",
      content: [
        { type: "image", image: { mediaType, base64: readFileSync(imageFile).toString("base64") } },
        { type: "text", text: prompt },
      ],
    },
  ],
  ...(json
    ? {
        jsonSchema: {
          type: "object",
          properties: { answer: { type: "string" } },
          required: ["answer"],
          additionalProperties: false,
        },
      }
    : {}),
});
console.log(json ? JSON.stringify(response.json, null, 2) : response.text);
console.error(
  `\n${response.model}, ${response.stop}${response.stopDetail ? ` (${response.stopDetail})` : ""}, ` +
    `${((Date.now() - started) / 1000).toFixed(1)}s, ` +
    `${response.usage.inputTokens} tokens in, ${response.usage.outputTokens} out` +
    `, ${response.usage.cacheReadTokens} cache read, ${response.usage.cacheWriteTokens} cache write` +
    (response.reportedCostUsd !== undefined ? `, reported cost $${response.reportedCostUsd}` : "") +
    (response.servedBy ? `, served by ${response.servedBy}` : "") +
    (response.unexpectedModel ? `\n${response.unexpectedModel}` : ""),
);
