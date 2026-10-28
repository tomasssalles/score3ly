-- Why a call failed (docs/llm.md, "Calling the providers"): the adapter's kind of error, and the HTTP status the
-- provider answered with, if any. A failed call without tokens whose HTTP status is an error (400 or above), or whose
-- kind is `auth` without a status, wasn't billed; any other may have been, so its cost is unknown. NULL for calls that
-- didn't throw, except an answer from an unexpected model (its tokens are recorded).
ALTER TABLE llm_calls ADD COLUMN error_kind TEXT;
ALTER TABLE llm_calls ADD COLUMN http_status INTEGER;
