// The config form (apps/web/src/configForm.ts, pure, on core alone) against the Worker's own checks (the code review's
// C21): every config the form lets a person save, from the pickers' options as the Worker sends them, makes a request
// that `configProblem` accepts. The form and the Worker say the same rules in two places; this keeps them agreeing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { configProblem, modelOptions } from "./modelConfigs.ts";
import { MODEL_LIST } from "./llm/modelList.ts";
import {
  EMPTY_FORM,
  effortsOf,
  familyOption,
  type FormState,
  missing,
  modelsOf,
  referencesOf,
  regionsOf,
  requestOf,
  routingsOf,
  settled,
} from "../../web/src/configForm.ts";

const options = modelOptions(MODEL_LIST, true); // the providers for development too

// The form after these picks, as the pickers settle it, with every secret of the chosen set named.
function form(fields: Partial<FormState>): FormState {
  const settledForm = settled(options, { ...EMPTY_FORM, ...fields });
  const set = familyOption(options, settledForm)?.secrets[settledForm.secretSet] ?? [];
  return settled(options, { ...settledForm, secrets: Object.fromEntries(set.map((field) => [field, `SECRET_${field.toUpperCase()}`])) });
}

// Each form: what the form lets a person save is what the Worker accepts.
function check(f: FormState, what: string): number {
  assert.equal(missing(options, f), null, what);
  assert.equal(configProblem(requestOf(f) as unknown as Record<string, unknown>), null, what);
  return 1;
}

// Every place of the form as it is: each region, each routing there, each account where the provider has one.
function* places(f: FormState): Generator<FormState> {
  const accounts = f.account === null ? [null] : (["standard", "business"] as const);
  for (const account of accounts) {
    const withAccount = settled(options, { ...f, account });
    for (const region of regionsOf(options, withAccount)) {
      const atRegion = settled(options, { ...withAccount, region, routing: null });
      const routings = routingsOf(options, atRegion);
      for (const routing of routings.length > 0 ? routings.map((r) => r.routing) : [null]) yield settled(options, { ...atRegion, routing });
    }
  }
}

test("every config the form lets a person save passes the Worker's checks: listed models, at every place, effort and set of secrets", () => {
  let checked = 0;
  for (const provider of options.providers) {
    for (const model of modelsOf(options, provider.id)) {
      const family = provider.families.find((f) => f.id === model.family)!;
      for (const [secretSet] of family.secrets.entries()) {
        for (const at of places(form({ provider: provider.id, model: { kind: "listed", id: model.id }, secretSet }))) {
          const where = `${model.id} on ${provider.id} at ${at.region}/${at.routing}/${at.account}`;
          for (const effort of [null, ...effortsOf(options, at)]) checked += check({ ...at, effort }, `${where} effort ${effort}`);
          checked += check({ ...at, pricing: "free" }, `${where} free`);
        }
      }
    }
  }
  assert.ok(checked > 100, `${checked} forms`);
});

test("every config the form lets a person save passes the Worker's checks: models added by hand, priced as each listed model, unpriced, free", () => {
  let checked = 0;
  for (const provider of options.providers) {
    for (const family of provider.families) {
      const added = form({ provider: provider.id, model: { kind: "added", string: "a-model-the-list-has-not", family: family.id } });
      for (const at of places(added)) {
        const where = `${family.id} added on ${provider.id} at ${at.region}/${at.routing}/${at.account}`;
        for (const effort of [null, ...effortsOf(options, at)]) {
          if (provider.pricedByProvider) {
            checked += check({ ...at, effort }, `${where} effort ${effort}`);
          } else {
            for (const reference of referencesOf(options, at)) checked += check({ ...at, effort, pricing: "as", reference: reference.id }, `${where} as ${reference.id}`);
            checked += check({ ...at, effort, pricing: "unpriced" }, `${where} unpriced`);
          }
          checked += check({ ...at, effort, pricing: "free" }, `${where} free`);
        }
      }
    }
  }
  assert.ok(checked > 100, `${checked} forms`);
});
