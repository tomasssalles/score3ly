-- The page count moves from the project to each stage (DESIGN.md §5.8): the selection of pages can change within a
-- project, and replaced stages keep their statistics.
ALTER TABLE projects DROP COLUMN page_count;

-- The number of pages the stage's inputs cover, set when it starts. NULL for Ingest, which doesn't read the PDF.
ALTER TABLE stages ADD COLUMN page_count INTEGER;
