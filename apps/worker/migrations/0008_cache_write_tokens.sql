-- Anthropic bills writing to its prompt cache apart from reading it (docs/llm.md, "Costs"): both are kept per call.
-- cached_tokens are the cache reads.
ALTER TABLE llm_calls ADD COLUMN cache_write_tokens INTEGER;
