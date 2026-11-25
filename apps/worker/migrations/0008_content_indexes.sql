-- Which rows name a stored object, found by its hash (the code review's E9): an import's content check counts an object
-- no row names as missing (`content/missing`, storage.ts), asking for up to 20 hashes at a time; without these, each
-- request would read every output and every call.
CREATE INDEX outputs_content ON outputs (content_sha256) WHERE content_sha256 IS NOT NULL;
CREATE INDEX llm_calls_request ON llm_calls (request_sha256) WHERE request_sha256 IS NOT NULL;
CREATE INDEX llm_calls_response ON llm_calls (response_sha256) WHERE response_sha256 IS NOT NULL;
