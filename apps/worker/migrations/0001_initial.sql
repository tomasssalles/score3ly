-- The whole schema of the database, and the rows a new database starts with (docs/database.md). Earlier migrations
-- were squashed into this one while no data needed keeping (CLAUDE.md, "Existing data"); later changes are 0002
-- onwards.
-- Nothing a deleted project leaves behind may be found by a cache lookup: such rows are marked with deleted_at, and
-- every cache lookup ignores marked rows. Times are ISO 8601, UTC, set by the Worker.

-- One row per project. Several projects can share a PDF.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  -- Unique among projects that aren't deleted, compared case-insensitively (index below).
  name TEXT NOT NULL COLLATE NOCASE,
  pdf_sha256 TEXT NOT NULL,
  -- The file's name when the project was created. Informational only.
  pdf_filename TEXT NOT NULL,
  run_mode TEXT NOT NULL DEFAULT 'auto' CHECK (run_mode IN ('auto', 'manual')),
  -- Optimistic locking (docs/database.md, "Optimistic locking"): raised by every change to the project's pipeline or
  -- name; a change sent with an older version is refused.
  version INTEGER NOT NULL DEFAULT 0,
  -- The number the next issue gets (#1, #2, ...). Never goes down.
  next_issue_number INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_modified_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX projects_pdf_sha256 ON projects (pdf_sha256);

CREATE UNIQUE INDEX projects_name ON projects (name) WHERE deleted_at IS NULL;

-- Model configs (docs/llm.md, "Configs"): a provider (a platform), a model of the app's list (`model_id`) or one the
-- user added (`model_string` with its `family`), never both, an effort, a place (region, routing on Bedrock only, the
-- project on Vertex AI only, the account's plan on OpenRouter only), the names of the Worker secrets to use, and how its
-- calls are priced: from the list (as its own model, or a model the user added as `pricing_reference`'s), free (the
-- user's free tier), unpriced, or by the provider (OpenRouter's answers say what each call cost). The
-- Worker checks the rest (`configProblem` in llmRoutes.ts): that the model, place and reference are in the list.
CREATE TABLE model_configs (
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
  -- 'provider': each answer says what it cost (OpenRouter's only); OpenRouter's configs may also be free tier.
  CHECK (pricing_kind <> 'provider' OR provider = 'openrouter'),
  CHECK (provider <> 'openrouter' OR pricing_kind IN ('provider', 'free'))
);

CREATE UNIQUE INDEX model_configs_name ON model_configs (name COLLATE NOCASE) WHERE deleted_at IS NULL;

-- Stages, shared by the pipelines that point to them (pipeline_entries), planned ones included.
CREATE TABLE stages (
  id TEXT PRIMARY KEY,
  -- The project the stage was created in.
  created_in TEXT NOT NULL REFERENCES projects (id),
  -- The step's id. Its kind is declared in code.
  step TEXT NOT NULL,
  -- Set when the stage starts.
  step_version INTEGER,
  status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'failed', 'done', 'wip', 'stopped')),
  -- The step's config: NULL while planned with the defaults; the resolved config once started.
  config_json TEXT,
  -- LLM stages: the model config, from the stage's creation on (docs/llm.md, "Which config a stage uses").
  model_config_id TEXT REFERENCES model_configs (id),
  -- hash(step, version, config, model's provider + model + effort, the inputs' content keys). Set when started.
  stage_key TEXT,
  -- The number of pages the stage's inputs cover, set when it starts. NULL for Ingest, which doesn't read the PDF.
  page_count INTEGER,
  -- Whether the stage is the recipe's (1) or one the user added (0), for the costs view (docs/database.md). A stage
  -- that replaces another takes its mark.
  in_recipe INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  -- One short fact about the result, e.g. "54 systems".
  note TEXT,
  -- A manual stage edited after it was finished: the stage it continues from.
  replaces_stage_id TEXT REFERENCES stages (id),
  created_at TEXT NOT NULL,
  started_at TEXT,
  -- Written once a minute while running; a running stage without a heartbeat for about 3 minutes was interrupted.
  heartbeat_at TEXT,
  finished_at TEXT,
  deleted_at TEXT
);

CREATE INDEX stages_key ON stages (stage_key) WHERE status = 'done' AND deleted_at IS NULL;

CREATE INDEX stages_created_in ON stages (created_in);

-- A project's pipeline: pointers to stages, in order.
CREATE TABLE pipeline_entries (
  project_id TEXT NOT NULL REFERENCES projects (id),
  -- 1, 2, 3, ... without gaps.
  position INTEGER NOT NULL,
  stage_id TEXT NOT NULL REFERENCES stages (id),
  -- A manual stage carried through a re-run (docs/overview.md §5.5): it stays in the pipeline, waiting, until its
  -- turn comes; then it is kept if what it reads is the same as what it read, and dropped otherwise.
  carried INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, position)
);

CREATE INDEX pipeline_entries_stage ON pipeline_entries (stage_id);

-- Every LLM call (docs/llm.md, "Calling the providers").
CREATE TABLE llm_calls (
  id TEXT PRIMARY KEY,
  -- NULL for a model config's test request (docs/llm.md, "The settings page"), which belongs to no stage.
  stage_id TEXT REFERENCES stages (id),
  model_config_id TEXT NOT NULL REFERENCES model_configs (id),
  -- hash of the exact request, with the model's provider, model and effort.
  request_key TEXT NOT NULL,
  -- The model the response says answered.
  response_model TEXT,
  -- The full request and response, in R2. NULL once the project is deleted.
  request_sha256 TEXT,
  response_sha256 TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error', 'unparseable', 'refused', 'cut_off')),
  error TEXT,
  -- Why a call failed: the adapter's kind of error, and the HTTP status the provider answered with, if any. A failed
  -- call without tokens whose HTTP status is an error (400 or above), or whose kind is `auth` without a status,
  -- wasn't billed; any other may have been, so its cost is unknown. NULL for calls that didn't throw, except an answer
  -- from an unexpected model (its tokens are recorded).
  error_kind TEXT,
  http_status INTEGER,
  input_tokens INTEGER,
  -- Thinking included.
  output_tokens INTEGER,
  -- Cache reads, and cache writes, which are billed apart.
  cached_tokens INTEGER,
  cache_write_tokens INTEGER,
  -- US dollars, computed when the call returns. 0 for free-tier configs, NULL for unpriced ones.
  cost_usd REAL,
  -- The prices the cost was computed with, and when they were collected. NULL for free and unpriced calls.
  price_json TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  deleted_at TEXT
);

CREATE INDEX llm_calls_cache ON llm_calls (request_key) WHERE status = 'ok' AND deleted_at IS NULL;

CREATE INDEX llm_calls_stage ON llm_calls (stage_id);

-- The spending cap sums the costs of the last 24 hours.
CREATE INDEX llm_calls_started_at ON llm_calls (started_at);

-- Every stage output (§5.2): stored content (in R2, under its hash) or a recipe.
CREATE TABLE outputs (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages (id),
  -- What the output is about: '' for the whole score, 'p3' for a page, 'p3/s2' for a system on it.
  item TEXT NOT NULL,
  -- What it is, e.g. 'pdf', 'page_image', 'layout', 'lens', 'issues', 'mei'.
  type TEXT NOT NULL,
  -- Stored content, in R2 under its hash.
  content_sha256 TEXT,
  -- Computed images: the hash of the recipe and the recipe itself.
  recipe_key TEXT,
  recipe_json TEXT,
  -- Manual outputs: the output they correct.
  parent_output_id TEXT REFERENCES outputs (id),
  -- LLM outputs: the call that produced the answer.
  call_id TEXT REFERENCES llm_calls (id),
  created_at TEXT NOT NULL,
  -- How long making the output took and what it found in the caches, for the run times' statistics: set by the
  -- browser for the items of a running stage, NULL for manual outputs. duration_ms: from the item's start to its
  -- output (images, model calls, checks); calls, calls_cached: the model answers it asked for, and how many were
  -- served from the record; images, images_cached: the images it looked up on the device, and how many were cached.
  duration_ms INTEGER,
  calls INTEGER,
  calls_cached INTEGER,
  images INTEGER,
  images_cached INTEGER,
  UNIQUE (stage_id, item, type),
  CHECK (content_sha256 IS NOT NULL OR recipe_key IS NOT NULL)
);

-- What each output was made from.
CREATE TABLE output_inputs (
  output_id TEXT NOT NULL REFERENCES outputs (id),
  input_id TEXT NOT NULL REFERENCES outputs (id),
  PRIMARY KEY (output_id, input_id)
);

-- What each stage read.
CREATE TABLE stage_inputs (
  stage_id TEXT NOT NULL REFERENCES stages (id),
  output_id TEXT NOT NULL REFERENCES outputs (id),
  PRIMARY KEY (stage_id, output_id)
);

-- Fingerprints of the images stored results were computed from (docs/images.md §8.3).
CREATE TABLE image_fingerprints (
  -- The image's cache key: the hash of its recipe.
  recipe_key TEXT PRIMARY KEY,
  -- The PDF the image comes from, so its fingerprints go when the PDF does.
  pdf_sha256 TEXT NOT NULL,
  -- The fingerprint code's version: only fingerprints of the same version are compared.
  version INTEGER NOT NULL DEFAULT 1,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  -- SHA-256 of the raw decoded pixels.
  pixels_sha256 TEXT NOT NULL,
  -- The downsampled grayscale thumbnail, base64, and its size.
  thumbnail TEXT NOT NULL,
  thumbnail_width INTEGER NOT NULL,
  thumbnail_height INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX image_fingerprints_pdf ON image_fingerprints (pdf_sha256);

-- The user's settings (docs/database.md); a setting without a row has its default, in the Worker.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A stage dropped at its turn because its inputs changed (docs/overview.md §5.5): the pipeline shows a card where it
-- was, after the stage it came after, until the user dismisses it, a change rewrites the pipeline there, or a stage of
-- the same step is added there again.
CREATE TABLE dropped_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects (id),
  after_stage_id TEXT NOT NULL REFERENCES stages (id),
  stage_id TEXT NOT NULL REFERENCES stages (id),
  step TEXT NOT NULL,
  dropped_at TEXT NOT NULL
);

CREATE INDEX dropped_stages_project ON dropped_stages (project_id);

-- How many times a manual stage was saved in each quarter of an hour (docs/statistics.md, "Active time"): the active
-- time of manual work. quarter: the start of the quarter of an hour, in ms since the epoch.
CREATE TABLE manual_saves (
  stage_id TEXT NOT NULL REFERENCES stages (id),
  quarter INTEGER NOT NULL,
  saves INTEGER NOT NULL,
  PRIMARY KEY (stage_id, quarter)
);

-- A new database comes with a model config for the fake provider, "Fake model", as the default (docs/llm.md): users
-- can try the app without keys and without paying. Free: it costs nothing and never meets the spending cap.
INSERT INTO model_configs (id, name, provider, model_id, pricing_kind, created_at)
VALUES ('fake-model', 'Fake model', 'fake', 'fake', 'free', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO settings (key, value_json, updated_at)
VALUES ('defaultModelConfigId', '"fake-model"', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
