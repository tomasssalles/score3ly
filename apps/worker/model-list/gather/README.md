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

`node model-list/gather/bedrock.ts --download` (done 2026-11-05; with the model cards, 2026-11-08). Its sources:

- **AWS's price list for Bedrock's foundation models** (`pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json`, public, about 10 MB). The excerpt keeps the on-demand rows in US dollars per million tokens of the listed models in the cards' regions, without batch, long context, the 1-hour cache write and reserved throughput. A row's `usagetype` says the routing: with "global" in it, global; otherwise regional, the same price for geographic and in-region (10% above global). Two spellings of usage types exist (older models: `InputTokenCount_Global`; newer: `input_tokens_global_standard`).
- **AWS's model card of each model in `claude-models.json`** ("Models at a glance", `docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-<id>.html`), for `bedrock-runtime`, the endpoint the app uses: the model ID (the inference profiles' IDs without their prefix: `anthropic.claude-haiku-4-5-20251001-v1:0`; the app adds the routing's prefix), the table of regions with the routings each offers (In-Region, Geo, Global: icons, read by their `alt`), and each geography's source regions, named by its profile's prefix (`EU`, `US`, `IN`, `US-GOV`, …). A card without IDs or that table for `bedrock-runtime` isn't listed (2026-11-08: the Mythos models, whose cards differ, and Opus 4). **A region has one geography in the list,** though some are a source of two (Tokyo: JP and APAC; Canada: US and CA): the one most models offer there, then the first by name; the others are printed and left out. The EU's regions have only EU.

A model gets a price at a region and routing only where all four prices (input, output, cache read, cache write) are there.

## OpenRouter

`node model-list/gather/openrouter.ts --download` (done 2026-11-08). OpenRouter prices each call itself (its answers say what they cost), so its file has no prices, only where it offers each model: everywhere (region `""`) and in the EU (`"eu"`, its EU host, a Business account). Its sources: **OpenRouter's models API on both hosts** (`openrouter.ai/api/v1/models`, `eu.openrouter.ai/api/v1/models`, public). The excerpt keeps the ids of the `anthropic/` and `google/` models per host. A model of `claude-models.json` or `gemini-models.json` is offered where its OpenRouter id is: the family's prefix and Anthropic's or Google's model ID, with a Claude version's last dash as a dot (`claude-opus-5-5` → `anthropic/claude-opus-5.5`); OpenRouter's other models are left out.

## Anthropic

`node model-list/gather/anthropic.ts --download` (done 2026-11-06). Its sources, both Anthropic's pages in their Markdown versions (the URL with `.md`):

- **"Pricing"** (`platform.claude.com/docs/en/about-claude/pricing.md`), the table "Model pricing": per model, named for people, its base input, 5-minute cache write, cache hit and output prices. Haiku 5.5's row for prompts over 100,000 tokens is left out (short-context prices only).
- **"Model deprecations"** (`platform.claude.com/docs/en/about-claude/model-deprecations.md`), the table of every model's API name and state. The API name is the model string, dated for the older models (`claude-sonnet-4-5-20250929`), which is also what the answer names, so the adapter's model check holds; without the date it is the app's id. Retired models aren't listed (Opus 4.1, Opus 4 and Sonnet 4 are, on Anthropic's API, though the pricing table still has them); deprecated ones are, until they retire.

A model in the pricing table that isn't in `claude-models.json`, or isn't in the table of states, stops the gathering.

## Google AI Studio

`node model-list/gather/ai-studio.ts --download` (done 2026-11-06). Its source is Google's page "Gemini Developer API pricing" in its Markdown version (`ai.google.dev/gemini-api/docs/pricing.md.txt`): one section per model, its model strings, and of its "Standard" tab the paid tier's input, output and context caching prices. Within a price cell:

- **Dated prices** ("$2.00 through November 30, 2026", "$4.00 starting December 1, 2026"): the one valid on the day of the gathering is taken, and the later ones are printed, to be noted in `docs/tasks.md` (decided 2026-11-06).
- **Left out:** prices for prompts over 200k tokens (short-context prices only), audio input, and the storage price of explicit caching (only implicit caching is used, which has no write price: cache write is 0). The free tier is left out too: it is a config's pricing kind.

`gemini-models.json` is kept by hand, like `claude-models.json`: the Gemini models the app lists, keyed by their string (the same on Vertex AI), with the app's id, the name and the efforts (from Google's page "Gemini thinking"), and the other models of this page and of Vertex AI's locations page, ignored. A model section in neither list stops the gathering, as does a price line the parsing doesn't understand, or a cell without exactly one price valid on the day.

## Vertex AI

`node model-list/gather/vertex.ts --download` (done 2026-11-06). Its sources are public pages, no credentials; Google's are fetched in English (`?hl=en`), since Google localizes them by where they are fetched from:

- **Anthropic's page "Claude Models on Google Cloud (Google managed)"** (`platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed.md`), the offering the app's adapter uses (`AnthropicVertex`; the other, "Anthropic managed", is `claude.googleapis.com`), the table "API model IDs": each Claude model's string on Vertex AI, with an `@` date for the models before 4.6 (`claude-opus-4-5@20251101`).
- **Google's page "Partner Models Pricing"** (`cloud.google.com/model-garden/partner-models/pricing`): the Claude prices, one tab per location (`global`, the multi-regions `us` and `eu`, and the regions us-east5, europe-west1, asia-southeast1, asia-east1). A model is served where its tab prices it. Of each, the short-context column (≤ 200K tokens, ≤ 100K for Haiku 5.5) of Input, Output, 5m Cache Write and Cache Hit.
- **Google's page "Vertex AI pricing"** (`cloud.google.com/vertex-ai/generative-ai/pricing`), its "Standard" tabs: the Gemini prices, input, output and cached input, short context, "Global" and "Non-global" (Gemini 2.5: one price everywhere). **Dated prices** (an introductory or promotional one "through December 31, 2026", the standard one "starting January 1, 2027"): **the standard one is taken** (decided 2026-11-06), which is what Google's billing catalog charges (the promotions are paid back as credits); it keeps the spending cap on the safe side, and no `#date` task is needed. Audio input is left out; implicit caching has no write price (cache write 0).
- **Google's page "Vertex AI locations"** (`cloud.google.com/vertex-ai/generative-ai/docs/learn/locations`), in HTML (the Markdown version has lost the marks): the section "Google model endpoint locations", which locations serve each Gemini model, and its string.

**Slips on Google's pages are left out, not guessed:** a model at a location whose table doesn't have exactly one price of each kind (a row missing, an output row labelled input, a row twice), a model without prices, and a model on Anthropic's page without a price on Google's (the Mythos models, Opus 4.1, Opus 4, Sonnet 4) are printed at the end, for the spot-check. A model on the locations page in neither list of `gemini-models.json` stops the gathering, as does a model on Anthropic's page that isn't in `claude-models.json`. `gemini-models.json` marks with `onlyOn` the models only one of AI Studio and Vertex AI offers.

### Cross-checking with Google's billing catalog, by hand

Google's Cloud Billing Catalog API has what Vertex AI bills, but not everything the gathering needs: of the Claude models only Opus 5.5 and Sonnet 5.5, no locations for Gemini, and SKU names without a pattern. So it isn't read by the script; a few prices are checked against it by hand (in the spot-check, `docs/tasks.md`). It needs credentials, but no billing account. Once:

```bash
gcloud services enable cloudbilling.googleapis.com --project score3ly
gcloud auth application-default set-quota-project score3ly
```

Then download Vertex AI's SKUs (service `C7E2-9256-1C43`, about 10,000) and look prices up by a pattern on their descriptions, in US dollars per million tokens:

```bash
TOKEN=$(gcloud auth application-default print-access-token)
URL=https://cloudbilling.googleapis.com/v1/services/C7E2-9256-1C43/skus
PAGE=""; while :; do
  R=$(curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: score3ly" "$URL?pageSize=5000&pageToken=$PAGE")
  echo "$R" | jq -c '.skus[]'
  PAGE=$(echo "$R" | jq -r '.nextPageToken // ""'); [ -z "$PAGE" ] && break
done > /tmp/vertex-skus.jsonl

price() { jq -r --arg p "$1" 'select(.description | test($p)) | "\(.description): $\(.pricingInfo[0].pricingExpression.tieredRates[0].unitPrice | ((.units | tonumber) + .nanos / 1e9) * 1e6)"' /tmp/vertex-skus.jsonl | sort; }
price 'Opus 5 5 .* eu .* from 0 '
price '^Gemini 4 Argon (Global|Regional) Text (Input|Output) - Online'
```

A "Regional" Gemini SKU is the "Non-global" price.
