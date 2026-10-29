-- How long making an output took, and what it found in the caches (docs/database.md): for the statistics of run times,
-- which estimate a fresh run from the items that really ran. Set by the browser for the items of a running stage; NULL
-- for manual outputs and those recorded before.
-- duration_ms: from the item's start to its output, in the browser (images, model calls, checks).
-- calls, calls_cached: the model answers the item asked for, and how many of them were served from the record.
-- images, images_cached: the images the item looked up on the device (each one, including those an image is made
-- from), and how many of them were found in the device's cache.
ALTER TABLE outputs ADD COLUMN duration_ms INTEGER;
ALTER TABLE outputs ADD COLUMN calls INTEGER;
ALTER TABLE outputs ADD COLUMN calls_cached INTEGER;
ALTER TABLE outputs ADD COLUMN images INTEGER;
ALTER TABLE outputs ADD COLUMN images_cached INTEGER;
