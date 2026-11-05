import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelOptions } from "./api";
import {
  confirmationOf,
  defaultModel,
  initialForm,
  withProvider,
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

test("every picker starts on its first entry: a listed model's first place and routing, its own price; the secrets' first names", () => {
  const anthropic = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual([anthropic.region, anthropic.routing, anthropic.pricing], ["", null, "list"]);
  assert.deepEqual(priceAt(OPTIONS, anthropic), P(4));
  const bedrock = pick({ provider: "bedrock" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual(regionsOf(OPTIONS, bedrock), ["eu-central-1"]);
  assert.deepEqual(routingsOf(OPTIONS, bedrock), [{ routing: "global" }, { routing: "geographic", geography: "EU" }]);
  assert.deepEqual([bedrock.region, bedrock.routing, bedrock.effort], ["eu-central-1", "global", null]);
  assert.deepEqual(priceAt(OPTIONS, settled(OPTIONS, { ...bedrock, routing: "geographic" })), P(4.4));
  assert.equal(missing(OPTIONS, bedrock), "It needs a secret, and none is set yet (Secrets, below)."); // no secrets to pick from
  const keys = settled(OPTIONS, bedrock, ["A_KEY", "B_KEY"]);
  assert.deepEqual(keys.secrets, { apiKey: "A_KEY" });
  assert.equal(missing(OPTIONS, keys), null);
  assert.deepEqual(settled(OPTIONS, { ...keys, secretSet: 1 }, ["A_KEY", "B_KEY"]).secrets, { accessKeyId: "A_KEY", secretAccessKey: "A_KEY" });
});

test("model and region filter each other: a model not served at the region moves it to the model's first", () => {
  const atUs = pick({ provider: "bedrock" }, { model: { kind: "added", string: "x", family: null }, pricing: "unpriced" }, { region: "us-east-1" });
  assert.equal(atUs.region, "us-east-1");
  const bedrock = modelsOf(OPTIONS, "bedrock");
  assert.deepEqual(
    bedrock.map((m) => [m.id, servedAtRegion(m, "bedrock", atUs.region)]),
    [
      ["opus", false],
      ["fable", true],
    ],
  );
  const opus = settled(OPTIONS, { ...atUs, model: { kind: "listed", id: "opus" } });
  assert.deepEqual([opus.region, opus.routing], ["eu-central-1", "global"]);
  const fable = settled(OPTIONS, { ...atUs, model: { kind: "listed", id: "fable" } });
  assert.deepEqual([fable.region, fable.routing], ["us-east-1", "in-region"]);
});

test("a model added by hand: its first family, priced as the first listed model of it, that one's places; unpriced, every place", () => {
  const added = pick({ provider: "bedrock" }, { model: { kind: "added", string: " anthropic.claude-opus-6 ", family: null } });
  assert.equal(added.model?.kind === "added" && added.model.family, "claude");
  assert.deepEqual([added.pricing, added.reference, added.region, added.routing], ["as", "opus", "eu-central-1", "global"]);
  assert.deepEqual(regionsOf(OPTIONS, added), ["eu-central-1"]);
  assert.deepEqual(regionsOf(OPTIONS, settled(OPTIONS, { ...added, pricing: "unpriced" })), ["eu-central-1", "us-east-1"]);
  // Priced as Fable instead: its place.
  const fable = settled(OPTIONS, { ...added, reference: "fable", region: null, routing: null });
  assert.deepEqual([fable.reference, fable.region, fable.routing], ["fable", "us-east-1", "in-region"]);
  const ready = settled(OPTIONS, { ...added, secrets: { apiKey: "BEDROCK_KEY" }, effort: "max" });
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
  // On Vertex AI, two families: the first, Claude.
  const vertex = pick({ provider: "vertex" }, { model: { kind: "added", string: "gemini-x", family: null } });
  assert.equal(vertex.model?.kind === "added" && vertex.model.family, "claude");
});

test("what follows the family: efforts and secrets; another provider starts over, keeping the name and Make default", () => {
  const form = pick({ provider: "vertex" }, { model: { kind: "added", string: "gemini-x", family: "gemini" } }, { effort: "max" });
  assert.equal(form.effort, null); // Gemini has no max
  const keys = pick({ provider: "bedrock" }, { model: { kind: "listed", id: "opus" } }, { secretSet: 1, secrets: { accessKeyId: "ID", apiKey: "K" } });
  assert.deepEqual(keys.secrets, { accessKeyId: "ID" });
  const other = withProvider(OPTIONS, { ...keys, name: "Mine", makeDefault: true }, "anthropic");
  assert.deepEqual([other.model, other.name, other.makeDefault, other.secrets], [{ kind: "listed", id: "opus" }, "Mine", true, {}]);
});

test("a listed model's request, named after its model, provider and effort unless a name is typed", () => {
  const form = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } }, { secrets: { apiKey: "ANTHROPIC_KEY" }, effort: "high" });
  assert.equal(missing(OPTIONS, form), null);
  assert.equal(defaultName(OPTIONS, form), "Claude Opus 5.5 (Anthropic) · high");
  assert.equal(confirmationOf(OPTIONS, form), null);
  assert.deepEqual(requestOf({ ...form, name: "  Opus  ", nameEdited: true }), {
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

test("the form opens on the first provider with its model: Opus 5.5 where offered, else Gemini 3.1 Pro, else the first", () => {
  const form = initialForm(OPTIONS);
  assert.deepEqual([form.provider, form.model, form.region], ["anthropic", { kind: "listed", id: "opus" }, ""]);
  const withGemini: ModelOptions = {
    ...OPTIONS,
    models: [...OPTIONS.models, { id: "gemini-3-1-pro", name: "Gemini 3.1 Pro", family: "gemini", providers: { vertex: { string: "gemini-3.1-pro", places: [{ region: "global", routing: null, price: P(2) }] } } }],
  };
  assert.deepEqual(defaultModel({ ...OPTIONS, models: OPTIONS.models.map((m) => (m.id === "opus" ? { ...m, id: "claude-opus-5-5" } : m)) }, "bedrock"), { kind: "listed", id: "claude-opus-5-5" });
  assert.deepEqual(defaultModel(withGemini, "vertex"), { kind: "listed", id: "gemini-3-1-pro" });
  assert.deepEqual(defaultModel(OPTIONS, "bedrock"), { kind: "listed", id: "opus" }); // the first listed
  assert.deepEqual(defaultModel(OPTIONS, "vertex"), { kind: "added", string: "", family: null }); // none listed
  // Another provider starts over with its own model, keeping the name typed and Make default.
  const other = withProvider(OPTIONS, { ...form, name: "Mine", nameEdited: true, makeDefault: true, effort: "high" }, "bedrock");
  assert.deepEqual([other.model, other.effort, other.name, other.nameEdited, other.makeDefault], [{ kind: "listed", id: "opus" }, null, "Mine", true, true]);
});

test("the default name stands in until the name is edited; an edited name is sent as it is", () => {
  const form = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } }, { secrets: { apiKey: "K" }, name: "stale" });
  assert.equal("name" in requestOf(form), false); // not edited: the Worker names it (and numbers it)
  assert.equal(requestOf({ ...form, name: " Opus ", nameEdited: true }).name, "Opus");
});
