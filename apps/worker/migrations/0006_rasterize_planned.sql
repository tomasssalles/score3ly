-- Projects created before rasterize existed get it as their second stage, planned with the defaults, as new
-- projects do. The ids are derived from the project's, since SQLite has no UUIDs.
INSERT INTO stages (id, created_in, step, status, config_json, created_at)
SELECT 'rasterize-' || id, id, 'rasterize', 'planned', NULL, created_at
FROM projects WHERE id NOT IN (SELECT project_id FROM pipeline_entries WHERE position = 2);

INSERT INTO pipeline_entries (project_id, position, stage_id)
SELECT p.id, 2, s.id FROM projects p JOIN stages s ON s.id = 'rasterize-' || p.id
WHERE p.id NOT IN (SELECT project_id FROM pipeline_entries WHERE position = 2);
