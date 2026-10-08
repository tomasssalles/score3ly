// Sends one image and a question to a vision LLM, with real keys, to try the adapters (src/llm) by hand:
//
//   ANTHROPIC_API_KEY=... npm run llm:try -w apps/worker -- anthropic claude-opus-5-5 page.png "How many systems?"
//   GEMINI_API_KEY=...    npm run llm:try -w apps/worker -- google gemini-3-pro page.jpg "How many systems?"
//
// Add --json to ask for {"answer": string} through the provider's schema-constrained output.

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createProvider, type LlmImage, type ProviderId } from "../src/llm/index.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [provider, model, imagePath, prompt] = args.filter((a) => a !== "--json");
if (!provider || !model || !imagePath || !prompt || (provider !== "anthropic" && provider !== "google")) {
  console.error("Usage: try-llm.ts <anthropic|google> <model> <image.png|.jpg|.webp> <prompt> [--json]");
  process.exit(1);
}
const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
const apiKey = process.env[keyName];
if (!apiKey) {
  console.error(`Set ${keyName}.`);
  process.exit(1);
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

// Relative to where the command was typed (npm runs the script in this package's folder).
const imageFile = resolve(process.env.INIT_CWD ?? process.cwd(), imagePath);

const started = Date.now();
const response = await createProvider(provider as ProviderId, { apiKey }).send({
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
