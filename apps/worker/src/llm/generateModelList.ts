// Step 2 of making the list of models and prices (docs/llm.md, "The list of models and prices: code, generated"): from
// one JSON file per provider (apps/worker/model-list/*.json, written by step 1, in the schema there), the list the app
// uses, as a TypeScript module (modelList.ts), and what changed since the previous one, to spot-check. Pure functions:
// scripts/generate-model-list.ts reads and writes the files.

import type { Effort } from "./types.ts";
import { listProblems, PROVIDERS, type Family, type ModelEntry, type ModelList, type PriceEntry, type Provider, type RegionEntry, type Routing } from "./models.ts";

// One provider's file (model-list/schema.json).
export type ProviderFile = {
  provider: Provider;
  collectedAt: string;
  mock?: boolean;
  sources: { url: string; note?: string }[];
  models: { id: string; name: string; family: Family; string: string; efforts?: Effort[]; thinking?: "adaptive" }[];
  regions: { region: string; routings: Routing[] | null; geography?: string }[];
  prices: { model: string; region: string; routing: Routing | null; input: number; output: number; cacheRead: number; cacheWrite: number; source: string }[];
};

// The list from the files, with the previous list's models that no file has any more kept, marked retired. Returns
// the problems instead where there are any: two files for one provider, a model whose name or family differs between
// files, and whatever `listProblems` finds in the result.
export function buildModelList(files: ProviderFile[], previous: ModelList | null): { list: ModelList } | { problems: string[] } {
  const problems: string[] = [];
  const ordered = [...files].sort((a, b) => PROVIDERS.indexOf(a.provider) - PROVIDERS.indexOf(b.provider));
  for (const [i, file] of ordered.entries()) {
    if (ordered.findIndex((other) => other.provider === file.provider) !== i) problems.push(`Two files for ${file.provider}.`);
  }
  const models = new Map<string, ModelEntry>();
  const regions: RegionEntry[] = [];
  const prices: PriceEntry[] = [];
  for (const file of ordered) {
    for (const m of file.models) {
      const entry = models.get(m.id);
      if (!entry) {
        models.set(m.id, {
          id: m.id,
          name: m.name,
          family: m.family,
          strings: { [file.provider]: m.string },
          ...(m.efforts ? { efforts: m.efforts } : {}),
          ...(m.thinking ? { thinking: m.thinking } : {}),
        });
      } else {
        if (entry.name !== m.name) problems.push(`Model ${m.id} is called "${entry.name}" in one file and "${m.name}" in ${file.provider}'s.`);
        if (entry.family !== m.family) problems.push(`Model ${m.id} is ${entry.family} in one file and ${m.family} in ${file.provider}'s.`);
        if (entry.strings[file.provider] !== undefined) problems.push(`Model ${m.id} is listed twice in ${file.provider}'s file.`);
        // A model's efforts and thinking are the model's, not the provider's: a file that says nothing takes another's.
        if (m.efforts) {
          if (entry.efforts && entry.efforts.join() !== m.efforts.join()) problems.push(`Model ${m.id} takes other efforts in ${file.provider}'s file.`);
          entry.efforts = m.efforts;
        }
        if (m.thinking) entry.thinking = m.thinking;
        entry.strings[file.provider] = m.string;
      }
    }
    for (const r of file.regions) regions.push({ provider: file.provider, region: r.region, routings: r.routings, ...(r.geography ? { geography: r.geography } : {}) });
    for (const p of file.prices) {
      prices.push({
        model: p.model,
        provider: file.provider,
        region: p.region,
        routing: p.routing,
        price: { input: p.input, output: p.output, cacheRead: p.cacheRead, cacheWrite: p.cacheWrite },
      });
    }
  }
  for (const old of previous?.models ?? []) {
    if (!models.has(old.id)) models.set(old.id, { ...old, retired: true });
  }
  const list: ModelList = {
    asOf: ordered.map((f) => f.collectedAt).sort()[0] ?? "",
    ...(ordered.some((f) => f.mock) ? { mock: true as const } : {}),
    models: [...models.values()],
    regions,
    prices,
  };
  problems.push(...listProblems(list));
  return problems.length > 0 ? { problems } : { list };
}

// The module the app imports (modelList.ts).
export function modelListModule(list: ModelList): string {
  return `// The list of models and prices the app uses (docs/llm.md, "The list of models and prices: code, generated").
// Generated from apps/worker/model-list/*.json by \`npm run model-list -w apps/worker\`: don't edit it by hand.

import type { ModelList } from "./models.ts";

export const MODEL_LIST: ModelList = ${JSON.stringify(list, null, 2)};
`;
}

const priceKey = (p: PriceEntry) => `${p.model} on ${p.provider}${p.region ? ` in ${p.region}` : ""}${p.routing ? ` (${p.routing})` : ""}`;
const priceText = (p: PriceEntry["price"]) => `$${p.input} / $${p.output} / $${p.cacheRead} / $${p.cacheWrite}`;

// What changed from the previous list to the new one, as lines to spot-check before a release: models added, retired
// and back, model strings changed, places added and gone, and prices added, gone and changed (input / output / cache
// read / cache write per million tokens).
export function listChanges(previous: ModelList | null, next: ModelList): string[] {
  const lines: string[] = [];
  const before = new Map((previous?.models ?? []).map((m) => [m.id, m]));
  for (const m of next.models) {
    const old = before.get(m.id);
    if (!old) lines.push(`Model added: ${m.name} (${m.id})${m.retired ? ", retired" : ""}`);
    else if (m.retired && !old.retired) lines.push(`Model retired: ${m.name} (${m.id})`);
    else if (!m.retired && old.retired) lines.push(`Model back: ${m.name} (${m.id})`);
    if (old) {
      for (const provider of PROVIDERS) {
        if (old.strings[provider] !== m.strings[provider]) {
          lines.push(`Model string of ${m.id} on ${provider}: ${old.strings[provider] ?? "none"} → ${m.strings[provider] ?? "none"}`);
        }
      }
    }
  }
  const regionKey = (r: RegionEntry) => `${r.provider} ${r.region || '""'}${r.routings ? ` (${r.routings.join(", ")})` : ""}${r.geography ? ` ${r.geography}` : ""}`;
  const oldRegions = new Set((previous?.regions ?? []).map(regionKey));
  const newRegions = new Set(next.regions.map(regionKey));
  for (const r of newRegions) if (!oldRegions.has(r)) lines.push(`Region added: ${r}`);
  for (const r of oldRegions) if (!newRegions.has(r)) lines.push(`Region gone: ${r}`);
  const oldPrices = new Map((previous?.prices ?? []).map((p) => [priceKey(p), p.price]));
  const newPrices = new Map(next.prices.map((p) => [priceKey(p), p.price]));
  for (const [key, price] of newPrices) {
    const old = oldPrices.get(key);
    if (!old) lines.push(`Price added: ${key}: ${priceText(price)}`);
    else if (priceText(old) !== priceText(price)) lines.push(`Price changed: ${key}: ${priceText(old)} → ${priceText(price)}`);
  }
  for (const [key, price] of oldPrices) if (!newPrices.has(key)) lines.push(`Price gone: ${key}: ${priceText(price)}`);
  return lines;
}
