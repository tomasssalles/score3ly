-- What a fingerprint needs besides migration 0003's columns (DESIGN.md §8.3): the fingerprint code's version (only
-- fingerprints of the same version are compared), the thumbnail's size, and when it was stored.
ALTER TABLE image_fingerprints ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE image_fingerprints ADD COLUMN thumbnail_width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE image_fingerprints ADD COLUMN thumbnail_height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE image_fingerprints ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
