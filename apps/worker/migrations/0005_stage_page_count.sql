-- The page count moves from the project to each stage (docs/database.md): the selection of pages can change within a
-- project, and replaced stages keep their statistics.
ALTER TABLE projects DROP COLUMN page_count;

-- The number of pages the stage's inputs cover, set when it starts. NULL for Ingest, which doesn't read the PDF.
ALTER TABLE stages ADD COLUMN page_count INTEGER;
