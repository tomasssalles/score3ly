-- Projects created before layout existed get it as their fourth stage, planned with the defaults, as new projects
-- do. The ids are derived from the project's, since SQLite has no UUIDs.
INSERT INTO stages (id, created_in, step, status, config_json, created_at)
SELECT 'layout-' || id, id, 'layout', 'planned', NULL, created_at
FROM projects WHERE id NOT IN (SELECT project_id FROM pipeline_entries WHERE position = 4);

INSERT INTO pipeline_entries (project_id, position, stage_id)
SELECT p.id, 4, s.id FROM projects p JOIN stages s ON s.id = 'layout-' || p.id
WHERE p.id NOT IN (SELECT project_id FROM pipeline_entries WHERE position = 4);
