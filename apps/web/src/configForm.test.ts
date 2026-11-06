import { test } from "node:test";
import assert from "node:assert/strict";
import type { ModelConfig, ModelOptions } from "./api";
import {
  confirmationOf,
  defaultModel,
  effortsOf,
  familyOf,
  formFromConfig,
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
      efforts: ["low", "medium", "high", "xhigh", "max"],
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
      efforts: ["low", "medium", "high", "xhigh", "max"],
      providers: { bedrock: { string: "anthropic.claude-fable-5-1", places: [{ region: "us-east-1", routing: "in-region", price: P(10) }] } },
    },
  ],
};

// The form as a user's picks leave it, each pick settled as the dialog does.
function pick(...changes: Partial<FormState>[]): FormState {
  return changes.reduce<FormState>((form, change) => settled(OPTIONS, { ...form, ...change }), EMPTY_FORM);
}

test("the pickers start on their first entry: a listed model's first place and routing, its own price; the secrets not chosen yet", () => {
  const anthropic = pick({ provider: "anthropic" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual([anthropic.region, anthropic.routing, anthropic.pricing], ["", null, "list"]);
  assert.deepEqual(priceAt(OPTIONS, anthropic), P(4));
  const bedrock = pick({ provider: "bedrock" }, { model: { kind: "listed", id: "opus" } });
  assert.deepEqual(regionsOf(OPTIONS, bedrock), ["eu-central-1"]);
  assert.deepEqual(routingsOf(OPTIONS, bedrock), [{ routing: "global" }, { routing: "geographic", geography: "EU" }]);
  assert.deepEqual([bedrock.region, bedrock.routing, bedrock.effort], ["eu-central-1", "global", null]);
  assert.deepEqual(priceAt(OPTIONS, settled(OPTIONS, { ...bedrock, routing: "geographic" })), P(4.4));
  assert.deepEqual(bedrock.secrets, {});
  assert.equal(missing(OPTIONS, bedrock), "The secret for the API key isn't chosen yet.");
  const keys = settled(OPTIONS, { ...bedrock, secrets: { apiKey: "A_KEY" } });
  assert.equal(missing(OPTIONS, keys), null);
  const pair = settled(OPTIONS, { ...keys, secretSet: 1 });
  assert.deepEqual(pair.secrets, {});
  assert.equal(missing(OPTIONS, settled(OPTIONS, { ...pair, secrets: { accessKeyId: "ID" } })), "The secret for the Secret access key isn't chosen yet.");
});

test("model and region filter each other: a model not served at the region moves it to the model's first", () => {
  const atUs = pick({ provider: "bedrock" }, { model: { kind: "added", string: "x", family: null } }, { region: "us-east-1" });
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

test("a model added by hand: its first family, every place of the provider, priced as a listed model of its family priced there, not chosen yet", () => {
  const added = pick({ provider: "bedrock" }, { model: { kind: "added", string: " anthropic.claude-opus-6 ", family: null } });
  assert.equal(added.model?.kind === "added" && added.model.family, "claude");
  assert.deepEqual([added.pricing, added.reference, added.region, added.routing], ["as", null, "eu-central-1", "global"]);
  assert.deepEqual(regionsOf(OPTIONS, added), ["eu-central-1", "us-east-1"]);
  assert.deepEqual(referencesOf(OPTIONS, added).map((m) => m.id), ["opus"]);
  assert.equal(missing(OPTIONS, settled(OPTIONS, { ...added, secrets: { apiKey: "K" } })), "The model it is priced as isn't chosen yet.");
  // Opus picked; then another region where Opus has no price: the model priced as is dropped, and only Fable is offered there.
  const opus = settled(OPTIONS, { ...added, reference: "opus" });
  const us = settled(OPTIONS, { ...opus, region: "us-east-1", routing: null });
  assert.deepEqual([us.reference, us.routing], [null, "global"]);
  assert.deepEqual(referencesOf(OPTIONS, us).map((m) => m.id), []); // Fable has a price there routed in-region only
  assert.deepEqual(referencesOf(OPTIONS, settled(OPTIONS, { ...us, routing: "in-region" })).map((m) => m.id), ["fable"]);
  const ready = settled(OPTIONS, { ...opus, secrets: { apiKey: "BEDROCK_KEY" }, effort: "max" });
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

test("the form opens on the first provider with its model: Opus 5.5 where offered, else Gemini 3.1 Pro Preview, else the first", () => {
  const form = initialForm(OPTIONS);
  assert.deepEqual([form.provider, form.model, form.region], ["anthropic", { kind: "listed", id: "opus" }, ""]);
  const gemini = (id: string, name: string, string: string) => ({ id, name, family: "gemini" as const, efforts: ["low" as const, "medium" as const, "high" as const], providers: { vertex: { string, places: [{ region: "global", routing: null, price: P(2) }] } } });
  const withGemini: ModelOptions = {
    ...OPTIONS,
    models: [...OPTIONS.models, gemini("gemini-4-argon", "Gemini 4 Argon", "gemini-4-argon"), gemini("gemini-3-1-pro-preview", "Gemini 3.1 Pro Preview", "gemini-3.1-pro-preview")],
  };
  assert.deepEqual(defaultModel({ ...OPTIONS, models: OPTIONS.models.map((m) => (m.id === "opus" ? { ...m, id: "claude-opus-5-5" } : m)) }, "bedrock"), { kind: "listed", id: "claude-opus-5-5" });
  assert.deepEqual(defaultModel(withGemini, "vertex"), { kind: "listed", id: "gemini-3-1-pro-preview" });
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

// A config as the Worker sends it, for a clone.
function config(fields: Partial<ModelConfig>): ModelConfig {
  return {
    id: "c1",
    name: "Opus EU",
    provider: "bedrock",
    modelId: "opus",
    modelString: null,
    model: "anthropic.claude-opus-5-5",
    family: "claude",
    modelName: "Claude Opus 5.5",
    unsupported: null,
    effort: "high",
    region: "eu-central-1",
    routing: "geographic",
    project: null,
    secrets: { secretAccessKey: "SECRET", accessKeyId: "ID" },
    pricing: { kind: "list", reference: null },
    price: { kind: "priced", price: P(4.4), borrowedFrom: null },
    freeTier: false,
    createdAt: "",
    deletedAt: null,
    ...fields,
  };
}

test("a clone starts from the original's values, its name as typed text, its secrets' set found", () => {
  const form = formFromConfig(OPTIONS, config({}));
  assert.deepEqual(
    [form.provider, form.model, form.region, form.routing, form.effort, form.secretSet, form.secrets, form.pricing, form.name, form.nameEdited],
    ["bedrock", { kind: "listed", id: "opus" }, "eu-central-1", "geographic", "high", 1, { secretAccessKey: "SECRET", accessKeyId: "ID" }, "list", "Opus EU", true],
  );
  assert.equal(missing(OPTIONS, form), null);
  assert.equal(requestOf(form).name, "Opus EU");
});

test("a clone of a config the app no longer supports keeps its values in the pickers, and can't be saved as it is", () => {
  // A listed model the list no longer has: its model, family and place stay.
  const retired = formFromConfig(OPTIONS, config({ modelId: "opus-4", modelName: "Claude Opus 4", unsupported: "uses Claude Opus 4 …", region: "us-east-1", routing: "global" }));
  assert.deepEqual([retired.model, retired.region, retired.routing], [{ kind: "listed", id: "opus-4" }, "us-east-1", "global"]);
  assert.equal(familyOf(OPTIONS, retired), "claude");
  assert.deepEqual(regionsOf(OPTIONS, retired), ["us-east-1"]);
  assert.equal(missing(OPTIONS, retired), "The app no longer supports Claude Opus 4 on Bedrock in us-east-1 (global routing).");
  // Another model: the original's place goes where the new one has no price.
  const opus = settled(OPTIONS, { ...retired, model: { kind: "listed", id: "opus" } });
  assert.deepEqual([opus.region, opus.routing], ["eu-central-1", "global"]);
  assert.equal(missing(OPTIONS, opus), null);
  // A listed model at a place it no longer has a price for: that place stays offered, as well as its own.
  const place = formFromConfig(OPTIONS, config({ region: "us-east-1", routing: "global" }));
  assert.deepEqual(regionsOf(OPTIONS, place), ["eu-central-1", "us-east-1"]);
  assert.match(missing(OPTIONS, place) ?? "", /no longer supports Claude Opus 5\.5 on Bedrock in us-east-1/);
  // A model added by hand priced as a model without a price there any more: that model stays picked.
  const added = formFromConfig(
    OPTIONS,
    config({ modelId: null, modelString: "anthropic.claude-opus-6", model: "anthropic.claude-opus-6", modelName: null, region: "us-east-1", routing: "global", pricing: { kind: "list", reference: "opus" }, price: { kind: "missing" } }),
  );
  assert.deepEqual([added.pricing, added.reference], ["as", "opus"]);
  assert.equal(missing(OPTIONS, added), "The app has no price for Claude Opus 5.5 on Bedrock in us-east-1 (global routing) any more.");
  assert.equal(missing(OPTIONS, settled(OPTIONS, { ...added, pricing: "unpriced" })), null);
});

test("a listed model that takes no effort level offers only the dash, and drops an effort picked before", () => {
  const haiku = { id: "haiku-4-5", name: "Claude Haiku 4.5", family: "claude" as const, efforts: [], providers: { anthropic: { string: "claude-haiku-4-5", places: [{ region: "", routing: null, price: P(1) }] } } };
  const options: ModelOptions = { ...OPTIONS, models: [...OPTIONS.models, haiku] };
  const opus = withProvider(options, { ...initialForm(options), effort: "high" }, "anthropic");
  assert.deepEqual(effortsOf(options, opus), ["low", "medium", "high", "xhigh", "max"]);
  const form = settled(options, { ...opus, effort: "high", model: { kind: "listed", id: "haiku-4-5" } });
  assert.deepEqual(effortsOf(options, form), []);
  assert.equal(form.effort, null);
});
