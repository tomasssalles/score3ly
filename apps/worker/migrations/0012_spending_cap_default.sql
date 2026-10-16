-- The spending cap can no longer be unset (DESIGN.md §10): without a stored value it is $1. A cap stored as null
-- (from when it could be unset) goes, so the default applies.
DELETE FROM settings WHERE key = 'spendingCapUsd' AND value_json = 'null';
