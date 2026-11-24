// The Worker's environment on Node (docs/desktop.md): D1 as a SQLite file (NodeD1), R2 as a folder of files (NodeR2),
// and the secrets, which a Worker has as its environment's other values. The desktop version's server builds its
// environment here, and so do the Worker's tests on the Node host (testPlatform.ts).

import type { NodeD1 } from "./d1.ts";
import type { NodeR2 } from "./r2.ts";

export type NodeEnvParts = {
  db: NodeD1;
  files: NodeR2;
  secrets?: Record<string, string>;
  devProviders?: boolean; // the providers for development offered too (DEV_PROVIDERS, docs/llm.md)
};

export function nodeEnv({ db, files, secrets = {}, devProviders = false }: NodeEnvParts): Env {
  return { ...secrets, ...(devProviders ? { DEV_PROVIDERS: "true" } : {}), DB: db, PDFS: files } as unknown as Env;
}
