// Every gathering's parsing, for the check that the committed excerpts still give the committed files
// (`npm run model-list -w apps/worker -- --check`, and its test).

import { readFileSync } from "node:fs";
import { parse as aiStudio } from "./ai-studio.ts";
import { parse as anthropic } from "./anthropic.ts";
import { parse as bedrock } from "./bedrock.ts";
import { type Gathered, paths, providerFileText } from "./common.ts";
import { parse as openrouter } from "./openrouter.ts";
import { parse as vertex } from "./vertex.ts";
import type { Provider } from "../../src/llm/models.ts";

// The gathered providers (the fake ones' files are written by hand).
export const GATHERINGS: [Provider, () => Gathered][] = [
  ["anthropic", anthropic],
  ["bedrock", bedrock],
  ["ai-studio", aiStudio],
  ["vertex", vertex],
  ["openrouter", openrouter],
];

// The providers whose file isn't what their committed excerpts give (a hand edit of the file, or a change of the
// parsing not run again), each with why; [] when every file is.
export function gatheringDrift(): string[] {
  const drift: string[] = [];
  for (const [provider, parse] of GATHERINGS) {
    let text: string;
    try {
      const { file } = parse();
      text = providerFileText(file);
    } catch (err) {
      drift.push(`${provider}: its excerpts don't parse: ${(err as Error).message}`);
      continue;
    }
    if (text !== readFileSync(paths(provider).output, "utf8")) drift.push(`${provider}: model-list/${provider}.json isn't what its excerpts give: run node model-list/gather/${provider}.ts.`);
  }
  return drift;
}
