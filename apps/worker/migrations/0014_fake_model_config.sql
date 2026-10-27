-- A new database comes with a model config for the fake provider, named "Fake model", as the default (
-- docs/llm.md): users can try the app without keys and without paying. Existing databases get it too, and it becomes their
-- default only where none is set. Free tier: it costs nothing and never meets the spending cap.
-- A fixed id, so the config is added once; a user who deletes it later doesn't get it back.
INSERT OR IGNORE INTO model_configs (id, name, provider, model, effort, params_json, secrets_json, free_tier, created_at)
VALUES ('fake-model', 'Fake model', 'fake', 'fake', NULL, '{}', '{}', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

DELETE FROM settings WHERE key = 'defaultModelConfigId' AND value_json = 'null';

INSERT OR IGNORE INTO settings (key, value_json, updated_at)
VALUES ('defaultModelConfigId', '"fake-model"', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
