-- Projects created before stages existed get their Ingest stage, as new projects do: done from the start, with the
-- PDF as its output, first in the pipeline. The ids are derived from the project's, since SQLite has no UUIDs.
INSERT INTO stages (id, created_in, step, step_version, status, config_json, created_at, started_at, finished_at)
SELECT 'ingest-' || id, id, 'ingest', 1, 'done', '{}', created_at, created_at, created_at
FROM projects WHERE id NOT IN (SELECT project_id FROM pipeline_entries);

INSERT INTO pipeline_entries (project_id, position, stage_id)
SELECT id, 1, 'ingest-' || id FROM projects WHERE id NOT IN (SELECT project_id FROM pipeline_entries);

INSERT INTO outputs (id, stage_id, item, type, content_sha256, created_at)
SELECT 'ingest-pdf-' || p.id, s.id, '', 'pdf', p.pdf_sha256, p.created_at
FROM projects p JOIN stages s ON s.id = 'ingest-' || p.id
WHERE s.id NOT IN (SELECT stage_id FROM outputs);
