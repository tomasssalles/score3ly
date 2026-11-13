-- VAT in the costs (docs/llm.md, "VAT"): the rate in force when a call's cost was recorded, a percentage. The call's
-- cost stays the cost before VAT (`cost_usd`); every cost shown or counted is the two together, so a later change of
-- the rate doesn't change past calls. 0 for the calls made before.
ALTER TABLE llm_calls ADD COLUMN vat_percent REAL NOT NULL DEFAULT 0;
