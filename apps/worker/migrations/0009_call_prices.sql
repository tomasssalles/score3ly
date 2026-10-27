-- The prices a call's cost was computed with, and when they were collected (docs/llm.md, "Costs"): a later price table
-- doesn't change past costs, and the record says which prices they rest on. NULL for free-tier and failed calls.
ALTER TABLE llm_calls ADD COLUMN price_json TEXT;
