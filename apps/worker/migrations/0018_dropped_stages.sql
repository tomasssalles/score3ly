-- A manual stage dropped at its turn because its inputs changed (DESIGN.md §5.5): the pipeline shows a card where it
-- was, after the stage it came after, until the user dismisses it, a change rewrites the pipeline there, or a stage
-- of the same step is added there again.
CREATE TABLE dropped_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  after_stage_id TEXT NOT NULL REFERENCES stages(id),
  stage_id TEXT NOT NULL REFERENCES stages(id),
  step TEXT NOT NULL,
  dropped_at TEXT NOT NULL
);
CREATE INDEX dropped_stages_project ON dropped_stages(project_id);
