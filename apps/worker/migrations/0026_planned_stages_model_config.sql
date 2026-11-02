-- Every LLM stage names its model config from the moment it is created (docs/llm.md, "Which config a stage uses"):
-- the planned ones that don't yet get the default model config now, in their config and as their model config.
UPDATE stages
SET config_json = json_set(COALESCE(config_json, '{}'), '$.modelConfigId', (SELECT json_extract(value_json, '$') FROM settings WHERE key = 'defaultModelConfigId')),
    model_config_id = (SELECT json_extract(value_json, '$') FROM settings WHERE key = 'defaultModelConfigId')
WHERE status = 'planned'
  AND step IN ('layout', 'analyze', 'extract', 'review', 'apply_review')
  AND json_extract(COALESCE(config_json, '{}'), '$.modelConfigId') IS NULL
  AND (SELECT json_extract(value_json, '$') FROM settings WHERE key = 'defaultModelConfigId') IN (SELECT id FROM model_configs);

-- Planned copies that already name one in their config (made by a change after the stage they replace had run) get it
-- as their model config too, so that their cards show it.
UPDATE stages
SET model_config_id = json_extract(config_json, '$.modelConfigId')
WHERE status = 'planned'
  AND model_config_id IS NULL
  AND json_extract(config_json, '$.modelConfigId') IN (SELECT id FROM model_configs);
