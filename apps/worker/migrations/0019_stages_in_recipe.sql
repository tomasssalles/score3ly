-- Whether a stage is the recipe's, or one the user added (docs/database.md): for the costs view, which tells the
-- default pipeline from the user's additions, e.g. the recipe's review from further reviews. A stage that replaces
-- another (a config change, a stop, a planned copy after a change) takes its mark. Existing stages are the recipe's
-- unless their step is manual. The default is 1 so that later migrations giving old projects a new recipe stage
-- needn't set it; the Worker sets it on every stage it creates.
ALTER TABLE stages ADD COLUMN in_recipe INTEGER NOT NULL DEFAULT 1;

UPDATE stages SET in_recipe = 0 WHERE step IN ('fix_skew', 'fix_layout', 'fix_metadata', 'fix_observations', 'human_review', 'fix_mei');
