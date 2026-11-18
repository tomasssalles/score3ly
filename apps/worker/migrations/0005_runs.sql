-- A stage's runs (docs/database.md, "An interrupted run"; the code review, A11 and A16, 2026-11-18).
-- The current or last run's id, given by `start` and sent with the run's outputs, heartbeats and end, so that a run that
-- is over (interrupted, then started again elsewhere) can't write any more.
ALTER TABLE stages ADD COLUMN run_id TEXT;
-- When the current or last run started (`started_at` is the first run's start).
ALTER TABLE stages ADD COLUMN run_started_at TEXT;
-- The summed time of the stage's ended runs, in milliseconds: its run time (decided 2026-11-17, dec. 41). NULL for a
-- stage that never ran (a planned or manual one, Ingest).
ALTER TABLE stages ADD COLUMN run_ms INTEGER;
