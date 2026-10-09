// Sends one image and a question to a vision LLM, with real keys, to try the adapters (src/llm) by hand:
//
//   ANTHROPIC_API_KEY=... npm run llm:try -w apps/worker -- anthropic claude-opus-5-5 page.png "How many systems?"
//   GEMINI_API_KEY=...    npm run llm:try -w apps/worker -- google gemini-3-pro page.jpg "How many systems?"
//   VERTEX_SERVICE_ACCOUNT=key.json VERTEX_REGION=eu \
//                         npm run llm:try -w apps/worker -- anthropic-vertex claude-opus-5-5 page.png "How many systems?"
//
//   BEDROCK_API_KEY=... BEDROCK_REGION=eu-central-1 \
//                         npm run llm:try -w apps/worker -- anthropic-bedrock eu.anthropic.claude-opus-5-5 page.png "..."
//
// For Vertex AI, VERTEX_SERVICE_ACCOUNT is the path of a service account's key file (JSON), VERTEX_REGION the region
// ("eu" if left out), and VERTEX_PROJECT the project (the key file's if left out). For Bedrock, BEDROCK_API_KEY is a
// Bedrock API key, or else AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY an access key pair; BEDROCK_REGION is the
// region ("eu-central-1" if left out). The model is the provider's own string for it.
//
// Add --json to ask for {"answer": string} through the provider's schema-constrained output.

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createProvider, type LlmImage, type ProviderConfig } from "../src/llm/index.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [provider, model, imagePath, prompt] = args.filter((a) => a !== "--json");
if (
  !provider ||
  !model ||
  !imagePath ||
  !prompt ||
  !["anthropic", "anthropic-vertex", "anthropic-bedrock", "google"].includes(provider)
) {
  console.error(
    "Usage: try-llm.ts <anthropic|anthropic-vertex|anthropic-bedrock|google> <model> <image> <prompt> [--json]",
  );
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

const config: ProviderConfig =
  provider === "anthropic"
    ? { provider, apiKey: required("ANTHROPIC_API_KEY") }
    : provider === "google"
      ? { provider, apiKey: required("GEMINI_API_KEY") }
      : provider === "anthropic-bedrock"
        ? bedrockConfig()
        : {
            provider: "anthropic-vertex",
            serviceAccount: readFileSync(userPath(required("VERTEX_SERVICE_ACCOUNT")), "utf8"),
            region: process.env.VERTEX_REGION ?? "eu",
            projectId: process.env.VERTEX_PROJECT,
          };
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

function bedrockConfig(): ProviderConfig {
  const region = process.env.BEDROCK_REGION ?? "eu-central-1";
  const apiKey = process.env.BEDROCK_API_KEY;
  if (apiKey) return { provider: "anthropic-bedrock", region, apiKey };
  return {
    provider: "anthropic-bedrock",
    region,
    accessKeyId: required("AWS_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
  };
}

const imageFile = userPath(imagePath);

const started = Date.now();
const response = await createProvider(config).send({
  model,
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
    `${response.usage.inputTokens} tokens in, ${response.usage.outputTokens} out`,
);
