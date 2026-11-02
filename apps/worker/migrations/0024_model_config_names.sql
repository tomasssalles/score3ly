-- Model configs are named, and their names are unique, ignoring case, among the configs that aren't deleted
-- (docs/llm.md, "Model configs"). A config without a name gets one from its model and effort ("claude-opus-5-5 · high",
-- the model alone without an effort), numbered " (1)", " (2)", … where earlier configs that aren't deleted have it, like
-- project names. (No data needs keeping yet: the rare clash with a name already numbered is left to the index below.)
UPDATE model_configs
SET name = model || CASE WHEN effort IS NULL THEN '' ELSE ' · ' || effort END
WHERE name IS NULL OR trim(name) = '';

UPDATE model_configs
SET name = name || ' (' || (
  SELECT COUNT(*) FROM model_configs other
  WHERE other.deleted_at IS NULL AND other.rowid < model_configs.rowid AND other.name = model_configs.name COLLATE NOCASE
) || ')'
WHERE deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM model_configs other
    WHERE other.deleted_at IS NULL AND other.rowid < model_configs.rowid AND other.name = model_configs.name COLLATE NOCASE
  );

CREATE UNIQUE INDEX model_configs_name ON model_configs (name COLLATE NOCASE) WHERE deleted_at IS NULL;
