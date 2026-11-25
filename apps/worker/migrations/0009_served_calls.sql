-- Which stage owns a call (the code review's E4, the owner's dec. 15 and 17; docs/database.md, "Tables and rules"):
-- a request served from the record gets a row of its own, for the stage it was served to, as a call it consumed:
-- `served_from` names the call whose answer it is (a row with no `served_from` itself: the one that was paid for), its
-- cost is 0, and it carries the same request and response. NULL for every call that was sent.
ALTER TABLE llm_calls ADD COLUMN served_from TEXT REFERENCES llm_calls (id);

-- Deleting a project keeps a call alive while a live stage has a row served from it (deletion.ts).
CREATE INDEX llm_calls_served_from ON llm_calls (served_from) WHERE served_from IS NOT NULL;

-- Every call has its place (docs/overview.md §12, "Each call records its place"): a new row, or a place written, can't
-- be the placeholders that migration 0004 gave the calls made before it ("?" and 0). The rows that still have them (calls
-- the one-time script, now removed, couldn't place) are kept as they are, readable: the export of a project that has one
-- is refused, saying why (projectFile.ts). (Each trigger on one line, its body's ";END" unspaced: the tests' migration
-- runner splits statements at "; ".)
CREATE TRIGGER llm_calls_place_on_insert BEFORE INSERT ON llm_calls WHEN NEW.item = '?' OR NEW.round < 1 BEGIN SELECT RAISE(ABORT, 'an LLM call needs its place: an item and a round from 1');END;
CREATE TRIGGER llm_calls_place_on_update BEFORE UPDATE OF item, round ON llm_calls WHEN NEW.item = '?' OR NEW.round < 1 BEGIN SELECT RAISE(ABORT, 'an LLM call needs its place: an item and a round from 1');END;
