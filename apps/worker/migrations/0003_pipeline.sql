-- The pipeline: stages, their outputs, LLM calls and model configs (DESIGN.md §5, "The database").
-- Nothing a deleted project leaves behind may be found by a cache lookup: such rows are marked with deleted_at,
-- and every cache lookup ignores marked rows.

-- Projects get the run mode, the optimistic lock, the issue counter, the page count and deletion. Name uniqueness
-- now only counts projects that aren't deleted, which needs a partial index instead of the column's UNIQUE, so
-- the table is rebuilt.
CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  -- Unique among projects that aren't deleted, compared case-insensitively (index below).
  name TEXT NOT NULL COLLATE NOCASE,
  pdf_sha256 TEXT NOT NULL,
  -- The file's name when the project was created. Informational only.
  pdf_filename TEXT NOT NULL,
  -- The PDF's number of pages, for statistics. NULL for projects created before it was recorded.
  page_count INTEGER,
  run_mode TEXT NOT NULL DEFAULT 'auto' CHECK (run_mode IN ('auto', 'manual')),
  -- Optimistic locking: raised by every write to the project's pipeline; a stale write is rejected.
  version INTEGER NOT NULL DEFAULT 0,
  -- The number the next issue gets (#1, #2, ...). Never goes down.
  next_issue_number INTEGER NOT NULL DEFAULT 1,
  -- ISO 8601, UTC, set by the Worker.
  created_at TEXT NOT NULL,
  last_modified_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL,
  deleted_at TEXT
);

INSERT INTO projects_new (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at)
SELECT id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at FROM projects;

DROP TABLE projects;

ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX projects_pdf_sha256 ON projects (pdf_sha256);

CREATE UNIQUE INDEX projects_name ON projects (name) WHERE deleted_at IS NULL;

-- Named combinations of provider, model, effort and credentials. Append-only: an edit marks the row deleted and
-- adds a new one, so stages and calls always point to what they really used.
CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  -- Optional, shown on the stage cards.
  name TEXT,
  provider TEXT NOT NULL,
  -- The provider's own string.
  model TEXT NOT NULL,
  effort TEXT,
  -- Plain values the provider needs, e.g. a region or a project. Not part of any cache key.
  params_json TEXT NOT NULL DEFAULT '{}',
  -- {field: name of a Worker secret}. Never the secret itself. Not part of any cache key.
  secrets_json TEXT NOT NULL DEFAULT '{}',
  -- Marked as free tier by the user: its calls cost $0.00 and don't count towards the spending cap.
  free_tier INTEGER NOT NULL DEFAULT 0,
  -- The row this one replaced when the config was edited.
  supersedes_id TEXT REFERENCES model_configs (id),
  created_at TEXT NOT NULL,
  -- Set when the config is deleted or edited.
  deleted_at TEXT
);

-- One row per stage, planned ones included. A stage isn't owned by a pipeline: forks point to the same rows.
-- Once finished (done), a stage never changes.
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
  -- LLM stages: the model config used. NULL while planned with the settings' choice.
  model_config_id TEXT REFERENCES model_configs (id),
  -- hash(step, version, config, model's provider + model + effort, the inputs' content keys). Set when started.
  stage_key TEXT,
  error TEXT,
  -- One short fact about the result, e.g. "54 systems".
  note TEXT,
  -- A manual stage edited after it was finished: the stage it continues from.
  replaces_stage_id TEXT REFERENCES stages (id),
  created_at TEXT NOT NULL,
  started_at TEXT,
  -- Written regularly while running; a running stage without a recent heartbeat was interrupted.
  heartbeat_at TEXT,
  finished_at TEXT,
  deleted_at TEXT
);

CREATE INDEX stages_key ON stages (stage_key) WHERE status = 'done' AND deleted_at IS NULL;

CREATE INDEX stages_created_in ON stages (created_in);

-- A project's pipeline: its stages in order.
CREATE TABLE pipeline_entries (
  project_id TEXT NOT NULL REFERENCES projects (id),
  -- 1, 2, 3, ... without gaps.
  position INTEGER NOT NULL,
  stage_id TEXT NOT NULL REFERENCES stages (id),
  PRIMARY KEY (project_id, position)
);

CREATE INDEX pipeline_entries_stage ON pipeline_entries (stage_id);

-- Call records, and the item-level cache for LLM requests: a successful call with the same request key is reused.
CREATE TABLE llm_calls (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES stages (id),
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
  input_tokens INTEGER,
  -- Thinking included.
  output_tokens INTEGER,
  cached_tokens INTEGER,
  -- US dollars, computed when the call returns. 0 for free-tier configs.
  cost_usd REAL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  deleted_at TEXT
);

CREATE INDEX llm_calls_cache ON llm_calls (request_key) WHERE status = 'ok' AND deleted_at IS NULL;

CREATE INDEX llm_calls_stage ON llm_calls (stage_id);

-- The spending cap sums the costs of the last 24 hours.
CREATE INDEX llm_calls_started_at ON llm_calls (started_at);

-- One row per item a stage produced.
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
  UNIQUE (stage_id, item, type),
  CHECK (content_sha256 IS NOT NULL OR recipe_key IS NOT NULL)
);

-- The outputs each output was made from.
CREATE TABLE output_inputs (
  output_id TEXT NOT NULL REFERENCES outputs (id),
  input_id TEXT NOT NULL REFERENCES outputs (id),
  PRIMARY KEY (output_id, input_id)
);

-- The outputs each stage read.
CREATE TABLE stage_inputs (
  stage_id TEXT NOT NULL REFERENCES stages (id),
  output_id TEXT NOT NULL REFERENCES outputs (id),
  PRIMARY KEY (stage_id, output_id)
);

-- Fingerprints of images sent to a model or worked on by a person, checked when the image is regenerated.
CREATE TABLE image_fingerprints (
  -- The image's cache key: the hash of its recipe.
  recipe_key TEXT PRIMARY KEY,
  -- The PDF the image comes from, so its fingerprints go when the PDF does.
  pdf_sha256 TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  -- SHA-256 of the raw decoded pixels.
  pixels_sha256 TEXT NOT NULL,
  -- The downsampled grayscale thumbnail, base64.
  thumbnail TEXT NOT NULL
);

CREATE INDEX image_fingerprints_pdf ON image_fingerprints (pdf_sha256);

-- The user's settings. Settings that depend on the device stay in the browser.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
