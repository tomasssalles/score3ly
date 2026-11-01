-- Projects created before review existed get it right after their extract, planned with the defaults, as new projects
-- do (docs/stages/music.md, `review`). The stages after extract move one place on: first out of the way (negative
-- positions, as the primary key is the project and the position), then back. The ids are derived from the project's,
-- since SQLite has no UUIDs.
INSERT INTO stages (id, created_in, step, status, config_json, created_at)
SELECT 'review-' || p.id, p.id, 'review', 'planned', NULL, p.created_at
FROM projects p
WHERE EXISTS (SELECT 1 FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'extract')
  AND NOT EXISTS (SELECT 1 FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'review');

UPDATE pipeline_entries
SET position = -(position + 1)
WHERE EXISTS (SELECT 1 FROM stages r WHERE r.id = 'review-' || pipeline_entries.project_id)
  AND NOT EXISTS (SELECT 1 FROM pipeline_entries x WHERE x.stage_id = 'review-' || pipeline_entries.project_id)
  AND position > (
    SELECT MAX(e.position) FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = pipeline_entries.project_id AND s.step = 'extract'
  );

UPDATE pipeline_entries SET position = -position WHERE position < 0;

INSERT INTO pipeline_entries (project_id, position, stage_id)
SELECT p.id, (SELECT MAX(e.position) FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = p.id AND s.step = 'extract') + 1, r.id
FROM projects p JOIN stages r ON r.id = 'review-' || p.id
WHERE NOT EXISTS (SELECT 1 FROM pipeline_entries e WHERE e.stage_id = r.id);
