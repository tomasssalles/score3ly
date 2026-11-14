-- Each LLM call's place (docs/overview.md §12, "Each call records its place"): the item, in the outputs' form ("p3" for
-- a page, "p3/s2" for a system, "" for the whole score and for a config's Test), and the round, from 1 (`layout`'s up
-- to 3). The calls made before get placeholders no call can have, "?" and 0, which the code treats as errors, until the
-- one-time script fills them from their stored requests (apps/worker/scripts/fill-call-places.ts).
ALTER TABLE llm_calls ADD COLUMN item TEXT NOT NULL DEFAULT '?';
ALTER TABLE llm_calls ADD COLUMN round INTEGER NOT NULL DEFAULT 0;
