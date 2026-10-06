-- One row per project. Several projects can share a PDF.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  pdf_sha256 TEXT NOT NULL,
  -- The file's name when the project was created. Informational only.
  pdf_filename TEXT NOT NULL,
  -- ISO 8601, UTC.
  created_at TEXT NOT NULL
);

CREATE INDEX projects_pdf_sha256 ON projects (pdf_sha256);
