-- Anthropic bills writing to its prompt cache apart from reading it (DESIGN.md §10): both are kept per call.
-- cached_tokens are the cache reads.
ALTER TABLE llm_calls ADD COLUMN cache_write_tokens INTEGER;
