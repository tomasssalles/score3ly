-- OpenRouter's configs may be marked free tier too (decided 2026-11-08): a model the user's account doesn't pay for.
-- So its pricing is 'provider' or 'free', and 'provider' stays OpenRouter's only. SQLite can't change a table's
-- CHECKs, so model_configs is rebuilt as in 0002.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE model_configs_new (
  id TEXT PRIMARY KEY,
  -- Unique among the configs that aren't deleted, ignoring case (index below).
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'bedrock', 'ai-studio', 'vertex', 'openrouter', 'fake', 'fake-dev')),
  model_id TEXT,
  model_string TEXT,
  family TEXT CHECK (family IN ('claude', 'gemini', 'fake')),
  effort TEXT CHECK (effort IN ('low', 'medium', 'high', 'xhigh', 'max')),
  -- '' for providers without regions; on OpenRouter '' is global and 'eu' its EU host.
  region TEXT NOT NULL DEFAULT '',
  routing TEXT CHECK (routing IN ('global', 'geographic', 'in-region')),
  project TEXT,
  -- OpenRouter only: the account's plan, 'standard' or 'business' (the fee on credits; the EU for Business only).
  account TEXT CHECK (account IN ('standard', 'business')),
  -- The names of the Worker secrets per field of the adapter, e.g. {"apiKey": "ANTHROPIC_KEY"}; never their values.
  secrets_json TEXT NOT NULL DEFAULT '{}',
  pricing_kind TEXT NOT NULL CHECK (pricing_kind IN ('list', 'free', 'unpriced', 'provider')),
  pricing_reference TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK ((model_id IS NULL) <> (model_string IS NULL)),
  CHECK ((family IS NULL) = (model_string IS NULL)),
  CHECK (pricing_reference IS NULL OR (pricing_kind = 'list' AND model_string IS NOT NULL)),
  CHECK ((routing IS NULL) = (provider <> 'bedrock')),
  CHECK (project IS NULL OR provider = 'vertex'),
  CHECK ((account IS NULL) = (provider <> 'openrouter')),
  CHECK (region <> 'eu' OR provider <> 'openrouter' OR account = 'business'),
  CHECK (pricing_kind <> 'provider' OR provider = 'openrouter'),
  CHECK (provider <> 'openrouter' OR pricing_kind IN ('provider', 'free'))
);

INSERT INTO model_configs_new (id, name, provider, model_id, model_string, family, effort, region, routing, project, account, secrets_json, pricing_kind, pricing_reference, created_at, deleted_at)
  SELECT id, name, provider, model_id, model_string, family, effort, region, routing, project, account, secrets_json, pricing_kind, pricing_reference, created_at, deleted_at FROM model_configs;

DROP TABLE model_configs;

ALTER TABLE model_configs_new RENAME TO model_configs;

CREATE UNIQUE INDEX model_configs_name ON model_configs (name COLLATE NOCASE) WHERE deleted_at IS NULL;

PRAGMA defer_foreign_keys = OFF;
