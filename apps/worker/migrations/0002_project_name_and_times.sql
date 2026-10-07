-- Adds a name the user can change and the last-modified and last-opened times.
-- SQLite can't add a UNIQUE column in place, so the table is rebuilt.
CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  -- Unique, compared case-insensitively. Defaults to the PDF's file name without ".pdf",
  -- plus " (1)", " (2)", ... if that name is taken.
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pdf_sha256 TEXT NOT NULL,
  -- The file's name when the project was created. Informational only.
  pdf_filename TEXT NOT NULL,
  -- ISO 8601, UTC, set by the Worker.
  created_at TEXT NOT NULL,
  -- Any change to the project's own data, a rename included. Opening the project doesn't count.
  last_modified_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
);

-- Existing projects are named like new ones, numbered in creation order where a name repeats.
INSERT INTO projects_new (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at)
SELECT id, CASE WHEN n = 1 THEN base ELSE base || ' (' || (n - 1) || ')' END,
  pdf_sha256, pdf_filename, created_at, created_at, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(base) ORDER BY created_at, id) AS n
  FROM (
    SELECT *, CASE WHEN stem = '' THEN 'Untitled' ELSE stem END AS base
    FROM (
      SELECT *, trim(CASE WHEN lower(substr(trim(pdf_filename), -4)) = '.pdf'
        THEN substr(trim(pdf_filename), 1, length(trim(pdf_filename)) - 4)
        ELSE pdf_filename END) AS stem
      FROM projects
    )
  )
);

DROP TABLE projects;

ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX projects_pdf_sha256 ON projects (pdf_sha256);
