-- Model configs are never edited, only renamed, cloned and deleted (docs/llm.md, "Managing model configs"), so the
-- column naming the row an edit superseded goes.
ALTER TABLE model_configs DROP COLUMN supersedes_id;
