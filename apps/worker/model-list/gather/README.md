# Gathering the list of models and prices

Step 1 of the list of models and prices (`docs/llm.md`, "The list of models and prices: code, generated"): for each provider, the project owner, with Claude at their side, downloads the provider's price lists and pages, cuts out of them what the parsing reads, and writes one JSON file per provider in `apps/worker/model-list/` (schema: `../schema.json`). Step 2, `npm run model-list -w apps/worker`, then makes the module the app uses and prints what changed, to spot-check.

Run this before a release that should carry new models or prices; never from the app.

## What is where

- `claude-models.json`: **kept by hand.** The Claude models the app lists (the 4.x and 5.x generations), with the app's id, the name for people, the effort levels each takes (`[]` for none) and whether the adapter must ask for adaptive thinking. A model a provider's sources list that isn't here stops the gathering, so new models are decided on, not slipped in. Its facts come from Anthropic's documentation (model pages, "Thinking & Effort"); check them for each new model.
- `<provider>.ts`: the parsing for one provider. Expected to change from release to release (URLs move, formats change); each file's header says what it reads.
- `sources/<provider>/`: **the excerpts, committed**: only the entries and tables the parsing reads, each with the URL it came from and the day it was fetched (decided 2026-11-05: not the whole downloads, which are protected by copyright where prices, as facts, aren't, and large). The parsing runs on these, so anyone can check each price against its source and run it again on exactly what was seen.
- `downloads/`: the whole downloads. **Not committed** (`.gitignore`).

## Steps, for each provider

1. In `apps/worker`, run its script with `--download`: it fetches the sources, cuts the excerpts and writes `model-list/<provider>.json`. Without `--download` it parses the committed excerpts again.
2. If it stops with a model it doesn't know: look the model up, decide whether the app lists it (the 4.x and 5.x Claude models, for now), and add it to `claude-models.json` with its efforts and thinking; run again.
3. If it stops because a format changed (a table or a sentence not found, two prices for one thing): look at the download, fix the parsing, run again.
4. Read the diff of `sources/<provider>/` and `<provider>.json`: models, regions and prices that appear or vanish should make sense.
5. Run `npm run model-list -w apps/worker` and spot-check its report: models added and retired, prices changed. Then `npm test -w apps/worker`.
6. Commit the excerpts, the JSON file and the module together.

## Bedrock

`node model-list/gather/bedrock.ts --download` (done 2026-11-05). Its sources:

- **AWS's price list for Bedrock's foundation models** (`pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json`, public, about 10 MB). The excerpt keeps the on-demand rows in US dollars per million tokens of the models and regions on Anthropic's page, without batch, long context, the 1-hour cache write and reserved throughput. A row's `usagetype` says the routing: with "global" in it, global; otherwise regional, the same price for geographic and in-region (10% above global). Two spellings of usage types exist (older models: `InputTokenCount_Global`; newer: `input_tokens_global_standard`).
- **Anthropic's page "Claude in Amazon Bedrock"** (`platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock`): the models on the Messages API endpoint the app uses (`bedrock-mantle`), with their model strings, which decides which models are listed (not all the Claude models AWS prices are on that endpoint: Opus 4.6 and older aren't); the regions, with the routings each offers (Global; a geography, EU, US, JP or AU; "In-region only"); and the sentence naming the models the global endpoint serves (AWS prices the Mythos models globally too, but the page doesn't offer them there; the page decides).

A model gets a price at a region and routing only where all four prices (input, output, cache read, cache write) are there.

## Anthropic, Vertex AI, Google AI Studio

Still mock files (`"mock": true`), to gather the same way. Vertex AI and Gemini prices come from Google's Cloud Billing Catalog API, which needs credentials (an API key restricted to it, or `gcloud auth application-default login`), from a local `.env`, never from the repository. Anthropic's and AI Studio's prices are on their pricing pages.
