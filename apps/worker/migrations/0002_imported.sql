-- Exporting and importing a project (docs/database.md, "Exporting and importing a project"): what an import added.
-- A project: it came in by import, on that date (work done on it afterwards isn't marked). A stage or a call: the
-- import added it, or brought it back to life (a call), on that date. Nothing reads it yet.
ALTER TABLE projects ADD COLUMN imported_at TEXT;
ALTER TABLE stages ADD COLUMN imported_at TEXT;
ALTER TABLE llm_calls ADD COLUMN imported_at TEXT;
