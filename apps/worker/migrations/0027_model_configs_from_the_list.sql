-- Model configs name a model of the list of supported models, or a model the user added (docs/llm.md, "Configs"): the
-- providers are platforms (anthropic, bedrock, ai-studio, vertex; fake and fake-dev), the model is a listed one
-- (`model_id`) or a string with its family (`model_string`, `family`), never both, and a config is priced from the list
-- (as its own model, or as `pricing_reference`'s), free (the free-tier mark) or unpriced. The region, routing (Bedrock
-- only) and project (Vertex AI only) are columns of their own.
-- The rules between the columns are checked by the Worker (`configProblem` in llmRoutes.ts): SQLite can't add CHECKs to
-- a table, and rebuilding it breaks on the stages and calls that refer to it. They become CHECKs when the migrations
-- are squashed into one (§15).
-- No data needs keeping yet: the old rows are converted as far as they go (a model string is kept as one the user
-- added, unpriced; the free-tier mark becomes the pricing "free"; an old Bedrock string's routing prefix becomes the
-- routing).
ALTER TABLE model_configs ADD COLUMN model_id TEXT;
ALTER TABLE model_configs ADD COLUMN model_string TEXT;
ALTER TABLE model_configs ADD COLUMN family TEXT;
ALTER TABLE model_configs ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE model_configs ADD COLUMN routing TEXT;
ALTER TABLE model_configs ADD COLUMN project TEXT;
ALTER TABLE model_configs ADD COLUMN pricing_kind TEXT NOT NULL DEFAULT 'unpriced';
ALTER TABLE model_configs ADD COLUMN pricing_reference TEXT;

UPDATE model_configs SET
  model_id = CASE WHEN provider IN ('fake', 'fake-dev') AND model = 'fake' THEN 'fake' END,
  model_string = CASE
    WHEN provider IN ('fake', 'fake-dev') AND model = 'fake' THEN NULL
    WHEN provider = 'anthropic-bedrock' AND (model LIKE 'global.%' OR model LIKE 'eu.%' OR model LIKE 'us.%' OR model LIKE 'jp.%' OR model LIKE 'au.%' OR model LIKE 'apac.%')
      THEN substr(model, instr(model, '.') + 1)
    ELSE model
  END,
  family = CASE
    WHEN provider IN ('fake', 'fake-dev') AND model = 'fake' THEN NULL
    WHEN provider IN ('anthropic', 'anthropic-bedrock', 'anthropic-vertex') THEN 'claude'
    WHEN provider IN ('google', 'google-vertex') THEN 'gemini'
    ELSE 'fake'
  END,
  region = COALESCE(json_extract(params_json, '$.region'), ''),
  routing = CASE
    WHEN provider <> 'anthropic-bedrock' THEN NULL
    WHEN model LIKE 'global.%' THEN 'global'
    WHEN model LIKE 'eu.%' OR model LIKE 'us.%' OR model LIKE 'jp.%' OR model LIKE 'au.%' OR model LIKE 'apac.%' THEN 'geographic'
    ELSE 'in-region'
  END,
  project = CASE WHEN provider IN ('anthropic-vertex', 'google-vertex') THEN json_extract(params_json, '$.projectId') END,
  pricing_kind = CASE WHEN free_tier = 1 THEN 'free' WHEN provider IN ('fake', 'fake-dev') AND model = 'fake' THEN 'list' ELSE 'unpriced' END;

UPDATE model_configs SET provider = CASE provider
  WHEN 'anthropic-bedrock' THEN 'bedrock'
  WHEN 'anthropic-vertex' THEN 'vertex'
  WHEN 'google' THEN 'ai-studio'
  WHEN 'google-vertex' THEN 'vertex'
  ELSE provider
END;

ALTER TABLE model_configs DROP COLUMN model;
ALTER TABLE model_configs DROP COLUMN params_json;
ALTER TABLE model_configs DROP COLUMN free_tier;
