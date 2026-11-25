-- The PDF's page count (docs/database.md, "Page counts"; the code review's dec. 20), counted by the browser when the PDF
-- is picked and sent with the create, so that setting `rasterize`'s pages needn't open the PDF. NULL where it wasn't
-- counted (a PDF pdf.js can't open, a project made before, a file exported before).
ALTER TABLE projects ADD COLUMN page_count INTEGER;
