// Sends one image and a question to a vision LLM, with real keys, to try the adapters (src/llm) by hand:
//
//   ANTHROPIC_API_KEY=... npm run llm:try -w apps/worker -- anthropic claude-opus-5-5 page.png "How many systems?"
//   GEMINI_API_KEY=...    npm run llm:try -w apps/worker -- google gemini-3-pro page.jpg "How many systems?"
//   VERTEX_SERVICE_ACCOUNT=key.json VERTEX_REGION=eu \
//                         npm run llm:try -w apps/worker -- anthropic-vertex claude-opus-5-5 page.png "How many systems?"
//
// For Vertex AI, VERTEX_SERVICE_ACCOUNT is the path of a service account's key file (JSON), VERTEX_REGION the region
// ("eu" if left out), and VERTEX_PROJECT the project (the key file's if left out).
//
// Add --json to ask for {"answer": string} through the provider's schema-constrained output.

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createProvider, type LlmImage, type ProviderConfig } from "../src/llm/index.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [provider, model, imagePath, prompt] = args.filter((a) => a !== "--json");
if (!provider || !model || !imagePath || !prompt || !["anthropic", "anthropic-vertex", "google"].includes(provider)) {
  console.error(
    "Usage: try-llm.ts <anthropic|anthropic-vertex|google> <model> <image.png|.jpg|.webp> <prompt> [--json]",
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
