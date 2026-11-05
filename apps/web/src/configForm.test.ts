import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelOptions } from "./api";
import {
  confirmationOf,
  defaultName,
  EMPTY_FORM,
  missing,
  modelsOf,
  priceAt,
  referencesOf,
  regionsOf,
  requestOf,
  routingsOf,
  servedAtRegion,
  settled,
  type FormState,
} from "./configForm.ts";

const P = (input: number) => ({ input, output: input * 5, cacheRead: input / 20, cacheWrite: input * 1.25 });
const CLAUDE = { id: "claude" as const, name: "Claude", efforts: ["low", "medium", "high", "xhigh", "max"] as const, secrets: [["apiKey"], ["accessKeyId", "secretAccessKey"]] };

const OPTIONS: ModelOptions = {
  asOf: "2026-11-05",
  mock: true,
  providers: [
    { id: "anthropic", name: "Anthropic", families: [{ ...CLAUDE, efforts: [...CLAUDE.efforts], secrets: [["apiKey"]] }], places: [{ region: "", routing: null }] },
    {
      id: "bedrock",
      name: "Bedrock",
      families: [{ ...CLAUDE, efforts: [...CLAUDE.efforts] }],
      places: [
        { region: "eu-central-1", routing: "global" },
        { region: "eu-central-1", routing: "geographic", geography: "EU" },
        { region: "us-east-1", routing: "global" },
        { region: "us-east-1", routing: "in-region" },
      ],
    },
    {
      id: "vertex",
      name: "Vertex AI",
      families: [
        { ...CLAUDE, efforts: [...CLAUDE.efforts], secrets: [["serviceAccount"]] },
        { id: "gemini", name: "Gemini", efforts: ["low", "medium", "high"], secrets: [["serviceAccount"]] },
      ],
      places: [{ region: "global", routing: null }],
    },
  ],
  models: [
    {
      id: "opus",
      name: "Claude Opus 5.5",
      family: "claude",
      providers: {
        anthropic: { string: "claude-opus-5-5", places: [{ region: "", routing: null, price: P(4) }] },
        bedrock: {
          string: "anthropic.claude-opus-5-5",
          places: [
            { region: "eu-central-1", routing: "global", price: P(4) },
            { region: "eu-central-1", routing: "geographic", price: P(4.4) },
          ],
        },
      },
    },
    {
      id: "fable",
      name: "Claude Fable 5.1",
      family: "claude",
      providers: { bedrock: { string: "anthropic.claude-fable-5-1", places: [{ region: "us-east-1", routing: "in-region", price: P(10) }] } },
    },
  ],
};

// The form as a user's picks leave it, each pick settled as the dialog does.
function pick(...changes: Partial<FormState>[]): FormState {
  return changes.reduce<FormState>((form, change) => settled(OPTIONS, { ...form, ...change }), EMPTY_FORM);
}

test("a listed model: its places only, a provider without regions picks its one place, its own price", () => {
  const anthropic = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual([anthropic.region, anthropic.routing, anthropic.pricing], ["", null, "list"]);
  assert.deepEqual(priceAt(OPTIONS, anthropic), P(4));
  const bedrock = pick({ provider: "bedrock" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual(regionsOf(OPTIONS, bedrock), ["eu-central-1"]);
  assert.equal(bedrock.region, "eu-central-1"); // the only region with its price: picked
  assert.deepEqual(routingsOf(OPTIONS, bedrock), [{ routing: "global" }, { routing: "geographic", geography: "EU" }]);
  assert.equal(missing(OPTIONS, bedrock), "Pick a routing.");
  const routed = settled(OPTIONS, { ...bedrock, routing: "geographic" });
  assert.deepEqual(priceAt(OPTIONS, routed), P(4.4));
  assert.equal(missing(OPTIONS, routed), "Pick the secrets.");
});

test("model and region filter each other: a model not served at the region clears it", () => {
  const atUs = pick({ provider: "bedrock" }, { model: { kind: "added", string: "x", family: null } }, { region: "us-east-1" });
  const bedrock = OPTIONS.models.filter((m) => modelsOf(OPTIONS, "bedrock").includes(m));
  assert.deepEqual(
    bedrock.map((m) => [m.id, servedAtRegion(m, "bedrock", atUs.region)]),
    [
      ["opus", false],
      ["fable", true],
    ],
  );
  const opus = settled(OPTIONS, { ...atUs, model: { kind: "listed", id: "opus" } });
  assert.equal(opus.region, "eu-central-1"); // us-east-1 dropped, the only region left picked
  const fable = settled(OPTIONS, { ...atUs, model: { kind: "listed", id: "fable" } });
  assert.deepEqual([fable.region, fable.routing], ["us-east-1", "in-region"]);
});

test("a model added by hand: its family (picked when the provider has one), every region, priced as a listed one of its family", () => {
  const added = pick({ provider: "bedrock" }, { model: { kind: "added", string: " anthropic.claude-opus-6 ", family: null } });
  assert.equal(added.model?.kind === "added" && added.model.family, "claude");
  assert.deepEqual(regionsOf(OPTIONS, added), ["eu-central-1", "us-east-1"]);
  assert.equal(added.pricing, null);
  // Priced as Opus: only Opus's places.
  const as = settled(OPTIONS, { ...added, pricing: "as", reference: "opus" });
  assert.deepEqual(regionsOf(OPTIONS, as), ["eu-central-1"]);
  assert.deepEqual(
    referencesOf(OPTIONS, as).map((m) => m.id),
    ["opus"],
  );
  const ready = settled(OPTIONS, { ...as, routing: "global", secrets: { apiKey: "BEDROCK_KEY" }, effort: "max" });
  assert.equal(missing(OPTIONS, ready), null);
  assert.deepEqual(requestOf(ready), {
    provider: "bedrock",
    modelString: "anthropic.claude-opus-6",
    family: "claude",
    effort: "max",
    region: "eu-central-1",
    routing: "global",
    secrets: { apiKey: "BEDROCK_KEY" },
    pricing: { kind: "list", reference: "opus" },
  });
  assert.equal(defaultName(OPTIONS, ready), "anthropic.claude-opus-6 (Bedrock) · max");
  assert.match(confirmationOf(OPTIONS, ready) ?? "", /use Claude Opus 5\.5's prices/);
  // On Vertex AI, two families: none picked for it.
  const vertex = pick({ provider: "vertex" }, { model: { kind: "added", string: "gemini-x", family: null } });
  assert.equal(vertex.model?.kind === "added" && vertex.model.family, null);
  assert.equal(missing(OPTIONS, vertex), "Pick the model's family.");
});

test("what follows the family: efforts and secrets; another provider starts over, keeping the name and Make default", () => {
  const form = pick({ provider: "vertex" }, { model: { kind: "added", string: "gemini-x", family: "gemini" } }, { effort: "max" });
  assert.equal(form.effort, null); // Gemini has no max
  const keys = pick({ provider: "bedrock" }, { model: { kind: "listed", id: "opus" } }, { secretSet: 1, secrets: { accessKeyId: "ID", apiKey: "K" } });
  assert.deepEqual(keys.secrets, { accessKeyId: "ID" });
  const other = settled(OPTIONS, { ...keys, name: "Mine", makeDefault: true, provider: "anthropic" });
  assert.deepEqual([other.model, other.name, other.makeDefault, other.secrets], [{ kind: "listed", id: "opus" }, "Mine", true, {}]);
});

test("a listed model's request, named after its model, provider and effort unless a name is given", () => {
  const form = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } }, { secrets: { apiKey: "ANTHROPIC_KEY" }, effort: "high" });
  assert.equal(missing(OPTIONS, form), null);
  assert.equal(defaultName(OPTIONS, form), "Claude Opus 5.5 (Anthropic) · high");
  assert.equal(confirmationOf(OPTIONS, form), null);
  assert.deepEqual(requestOf({ ...form, name: "  Opus  " }), {
    name: "Opus",
    provider: "anthropic",
    modelId: "opus",
    effort: "high",
    region: "",
    routing: null,
    secrets: { apiKey: "ANTHROPIC_KEY" },
    pricing: { kind: "list", reference: null },
  });
  const free = settled(OPTIONS, { ...form, pricing: "free" });
  assert.deepEqual(requestOf(free).pricing, { kind: "free" });
  assert.match(confirmationOf(OPTIONS, free) ?? "", /cost \$0\.00/);
});
