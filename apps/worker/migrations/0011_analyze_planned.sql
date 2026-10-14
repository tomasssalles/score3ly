-- Projects created before analyze existed get it after the recipe's last stage, planned with the defaults, as new
-- projects do. Manual stages may sit anywhere in a pipeline by now, so it goes at the end of each, unless the project
-- already has it. The ids are derived from the project's, since SQLite has no UUIDs.
INSERT INTO stages (id, created_in, step, status, config_json, created_at)
SELECT 'analyze-' || p.id, p.id, 'analyze', 'planned', NULL, p.created_at
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'analyze'
);

INSERT INTO pipeline_entries (project_id, position, stage_id)
SELECT p.id, (SELECT COALESCE(MAX(position), 0) + 1 FROM pipeline_entries WHERE project_id = p.id), s.id
FROM projects p JOIN stages s ON s.id = 'analyze-' || p.id
WHERE NOT EXISTS (SELECT 1 FROM pipeline_entries e WHERE e.stage_id = s.id);
