-- An import in progress (docs/database.md, "Exporting and importing a project"; the code review's batch 11, E1): its rows
-- come in several requests, so that each stays within a Worker's CPU time and D1's limits, and the project is hidden
-- until the last is in. `importing`: the SHA-256 of the file's project.json, by which a retry of the same file finds
-- the unfinished import and removes it first; NULL for every other project.
ALTER TABLE projects ADD COLUMN importing TEXT;

CREATE INDEX projects_importing ON projects (importing) WHERE importing IS NOT NULL;

-- What an import in progress has mapped and done, for its next requests and for removing it if it never finishes: per
-- kind ('config', 'stage', 'output', 'call'), the exported row's id and the row here, and whether the import made that
-- row (1) or found it here (0: a live config or stage it matched, an output of such a stage, a call it used or brought
-- back to life). A call brought back to life keeps its deletion time and import mark (`was_deleted_at`,
-- `was_imported_at`), given back if the import is removed. Emptied when the import finishes.
CREATE TABLE import_ids (
  project_id TEXT NOT NULL REFERENCES projects (id),
  kind TEXT NOT NULL CHECK (kind IN ('config', 'stage', 'output', 'call')),
  old_id TEXT NOT NULL,
  new_id TEXT NOT NULL,
  made INTEGER NOT NULL,
  was_deleted_at TEXT,
  was_imported_at TEXT,
  PRIMARY KEY (project_id, kind, old_id)
);
