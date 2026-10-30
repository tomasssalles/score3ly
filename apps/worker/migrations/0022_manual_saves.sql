-- How many times a manual stage was saved in each quarter of an hour (docs/tasks.md, "Other statistics", Effort): the
-- active time of manual work, for the statistics. A quarter with a save is active, and so is a quarter without one
-- between two active ones of the same stage (a gap of 15 minutes is work, longer is a break). Quarters, as everywhere
-- else in the statistics: they fit every time zone, and single saves would fill the database for little gain.
-- quarter: the start of the quarter of an hour, in ms since the epoch.
CREATE TABLE manual_saves (
  stage_id TEXT NOT NULL REFERENCES stages (id),
  quarter INTEGER NOT NULL,
  saves INTEGER NOT NULL,
  PRIMARY KEY (stage_id, quarter)
);
