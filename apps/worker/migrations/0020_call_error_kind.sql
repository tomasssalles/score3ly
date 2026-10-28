-- Why a call failed, when it threw (docs/llm.md, "Calling the providers"): the adapter's kind of error, and the HTTP
-- status the provider answered with, if any. A failed call without tokens whose error has an HTTP status wasn't billed;
-- one without a status may have been, so its cost is unknown. NULL for calls that didn't throw.
ALTER TABLE llm_calls ADD COLUMN error_kind TEXT;
ALTER TABLE llm_calls ADD COLUMN http_status INTEGER;
