-- A manual stage carried through a re-run (DESIGN.md §5.5): it stays in the pipeline, waiting, until its turn comes;
-- then it is kept if what it reads is the same as what it read, and dropped otherwise.
ALTER TABLE pipeline_entries ADD COLUMN carried INTEGER NOT NULL DEFAULT 0;
