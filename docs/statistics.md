# score3ly: the Statistics page

What the Statistics page shows and why, tab by tab: Costs (whose details are in [llm.md](llm.md), "The costs view"), Usage, Run times and Effort; how active time is counted; the parts the tabs share; the mock data. § numbers here are `docs/overview.md`'s sections. Decided 2026-10-27 to 2026-10-30, built.

## Why the tabs differ

The statistics are messy (the project owner, 2026-10-30). The hierarchical cache, several projects sharing a PDF, the arbitrary page selections in `rasterize`, re-runs and discarded stages, manual stages, extra reviews, no clear signal of when a project is finished, periods of inactivity, deleted projects: all of it makes a clear and consistent target hard to find. So the tabs use different approaches and answer different questions, each useful for its own purpose. For example:
- **the costs per page** merge the projects of a PDF into one score and count each page once, since cached stages are paid for once (llm.md, "The average cost per page");
- **the run times** leave the cache out item by item, and average per project;
- **the manual work** counts every page of each project, since no manual work is cached between projects.

Rethinking the whole page as one clean concept would be nice, but the statistics aren't a scientific experiment, and they aren't worth much more energy now: what is built is probably good enough for a while (the optional task "Rethink the Statistics page as one concept"; the optional tasks "Tags for projects" and "A "done" mark for projects" would help it).

## The page

- **One page, four tabs,** each with its own URL (`#/stats/costs`, `#/stats/usage`, `#/stats/times`, `#/stats/effort`; project-view.md, "The menu"), one menu entry. `StatsPage.tsx` holds the tabs and Costs; the others are `UsageTab.tsx`, `RunTimesTab.tsx` and `EffortTab.tsx`, their computations pure functions in `costs.ts`, `usage.ts`, `runTimes.ts` and `effort.ts`.
- **Blocks with the same head** (`StatHead` in `statsParts.tsx`; docs/style.md, "Blocks of a statistics page"): a title and an "i" on the left, the controls and the value on the right, a note under the value; a smaller form for the rows of a block, the "i" only where it is needed. The title, the controls and the value's first line share a text baseline.
- **Each block's time range is its own** (decided: not shared between tabs or blocks). Changing it keeps the block's other choices.
- **Deleted projects count everywhere**, marked "(deleted 12 Sep 2026)" where they are listed (docs/style.md); their rows are kept for the statistics (database.md, "Deleting a project"). A deleted or edited model config is marked "(until 15 Sep 2026)".
- **The "i" texts are the project owner's,** in the code.
- **The fake provider that ships with the app** costs nothing and never shows in the costs; `fake-dev` has made-up prices, for developing (llm.md, "Calling the providers").

## Costs

In llm.md: "Costs", "The costs view" (the spending cap's last 24 hours, the average cost per page, the detailed overview with its chart, split, filters and table, the call status, the LLM calls with unknown cost), "The average cost per page".

## Usage

When the app was in use, what it holds, and how reliable the calls were. Three blocks, each with a time range of its own where it has one.

### Activity
`UsageTab.tsx`, `usage.ts`, `GET /api/activity` in `apps/worker/src/activity.ts`. From what is recorded anyway:
- **A quarter of an hour is active if anything happened in it** (see "Active time"): an LLM call was running (start to end; one that never ended counts where it started), a stage started, ended or sent its last heartbeat, an output was saved, a project was created, a manual stage was saved (with its single gaps filled). A stage's start and end are events, not a span (decided: a retried stage keeps its first start, a manual stage left open for days isn't days of work).
- **The Worker sends the active quarters per project;** the browser counts them in the viewer's days.
- **Shown:** a time range of its own, the granularity as in Costs, bars or running total; the total in the head ("22 active hours", hours with up to two decimals, "on 11 days" under it, all projects); no split or filter, but a project picker without a label ("All projects" first, then the projects newest first) to see when a project was worked on, and a one-row table with the total for what is picked. "active hours" is said in the head, the table and the hint.

### Projects
`Projects` in `UsageTab.tsx`, `createdIn` in `usage.ts`, `GET /api/project-stats` in `apps/worker/src/projectStats.ts`. Decided 2026-10-29, replacing a block of pages transcribed per day, too complicated for what it told. A title, "Projects", and rows, without lines:
- **Current** and **Deleted:** over all time.
- **Pages processed:** the distinct pages of every `rasterize` stage that is done, replaced ones and those of deleted projects included, each page of a PDF once however many projects are on it. With an "i".
- **Created:** with a time range of its own (Last 30 days at first), the projects created in it, deleted ones included, and under the number what became of them, adding up to it: "3 done, 7 unfinished, 2 deleted". Done: not deleted and its pipeline finished now (its last stage done); a deleted project is only "deleted", whatever its state (mostly failed tries no one wants counted as done). Parts that are 0 are left out; no note when nothing was created.

### Failed calls
`Failures` in `UsageTab.tsx`, `failuresIn` in `usage.ts`, `GET /api/failures` in `apps/worker/src/failures.ts`. Decided 2026-10-29. How often calls fail, as counts: the $0 failures (rate limits, overloads, refused keys, no answer) are most of what makes a provider unreliable, and the Costs tab never shows them.
- **The head:** a time range and a model config picker side by side ("All model configs" first, then the configs newest first); the count of failed calls, and "of 495 calls (4%)" under it. Both pickers filter the count and the rows; neither resets the other.
- **A row per reason** with its count, the most frequent first, reasons with none left out: Overloaded, Rate limited, Server error, No connection, Timed out, Aborted, Unreadable response, Cut off, Refused, Unusable answer, Wrong model, Unexpected stop, Bad credentials, Bad request, Unknown error, Interrupted (still running 15 minutes after it started). From the calls' status and error kind (llm.md, "Calling the providers").
- **Counted:** every LLM call the Worker made, free-tier ones too; answers served from the record aren't calls; the fake provider that ships with the app is left out (some of its model names fail on purpose); a call still running only once it is 15 minutes old.

### Dropped (decided)
Stages run, LLM calls and tokens as plain counts (big numbers with no decision behind them), extra stages added (Effort's topic), discarded stages (in Costs, by kept or discarded).

## Run times

`RunTimesTab.tsx`, `runTimes.ts`, `GET /api/run-times` in `apps/worker/src/runTimes.ts`. Decided 2026-10-29 and 2026-10-30.
- **No time range:** the whole tab works on the projects selected in a filter like the average cost per page's (`FinishedProjectsFilter` in `ProjectFilter.tsx`, with `ProjectChecks` from `statsParts.tsx`, without "Remove projects with unfinished pipelines"). The filter has no title (decided: a title made it look like a block of its own that it applied to): on the right, the "i" and the filter button, and "2 projects selected" under them.
- **Only finished projects** (their pipeline's last stage done), deleted ones included, are listed and counted, ever (decided: an unfinished project's times would look shorter than they will be). The costs keep their unfinished projects.
- **"Average total time per project":** the average time from a project's creation to its pipeline's last finish (re-runs, fixes, breaks and all), and under it the average active hours (see "Active time").
- **"Average work time per page":** a row per step in the pipeline's order, manual ones included, with its average work time per page, "–" where it hasn't run in the selection. "split by" (lowercase mid-line, as "grouped by" in Costs) "–" or "Model config" adds a smaller row under each LLM step for each config its stages that started in the selection used (the other steps have none).
  - **Automatic steps are measured on the items that really ran** (database.md, "Each item's timing"): an LLM step's items with no answer from the record, `rasterize`'s items whose image was made, every item of the other steps. The mean, not the median: slow calls and the SDK's own retries belong in a realistic estimate.
  - **Per page:** for each kind of item (a page, a system, the whole score), the mean time of the items that ran times the items of that kind per page in the step's finished stages. So steps by system are scaled by the systems per page, and `apply_review`, which works only where there are issues, by its own share. The counts don't depend on the cache: every item of a finished stage has its output, whether its answer was asked or served from the record, and a stage reused whole counts once, in the project it was created in. (The systems per page come from the stages' outputs, not from the layouts' content: the owner's rule, the latest finished `fix_layout`'s, else the median over finished `layout`s, would read every layout from storage, and for finished projects the extractions have one item per system of their layouts anyway.)
  - **Each project weighs the same:** a step's time per page is worked out for each project on its own, then averaged over the projects with data for it; a project whose items for the step all came from the cache has none, and is left out rather than counted as nothing. Projects on the same PDF aren't merged: the cache is already left out item by item.
  - **Manual steps:** their finished stages' active time (see "Active time"), over their pages.
- **"Estimated time per page for new scores":** the sum of the recipe's steps' work times (the Worker sends the recipe, `RECIPE` in `apps/worker/src/pipeline.ts`): the recipe's stages once each in Auto mode, no manual stages (they have rows but stay out of it), extra reviews, re-runs or breaks. A step of the recipe without data makes it "–", with "insufficient data" under it (decided: rare, a step added to the recipe after the selected projects ran, or one whose every item came from the cache; a compromise rather than a longer explanation). With nothing selected, the whole tab shows dashes, without that note.
- **Dropped (decided):** full-project times per page, which the user's breaks would overshadow.

## Effort

`EffortTab.tsx`, `effort.ts`, on the same data as Run times. Decided 2026-10-30. How much the user had to step in. Its explanation at the top: "This page is about how often the automated pipeline wasn't good enough and you had to swoop in and save the day." Then the same filter as Run times (finished projects only, since an unfinished one may not yet have reached the point where it needs help).
- **"Average manual work per page":** each project's active time in manual stages over its own pages, every page counted (no manual work is cached between projects, only within a project's re-runs, so no merging of projects on the same PDF), then the mean over the selected projects, each weighing the same. A row per manual step (Fix skew, Fix layout, Fix metadata, Fix observations, Human review, Fix MEI) with its time per page and "used in 40% of projects" under it; the rows add up to the head. No share of the projects' active time (decided: the automated pipeline is likely a small fraction of the manual work, people being slow).
- **"Extra reviews per project":** reviews not in the recipe, counted (a project can have several), as an average per project with one decimal ("0.4"); "–" while no project has any review. No time.
- **Only the final pipeline counts** (decided: the work that was necessary; discarded stages could have been avoided with the right configs from the start): its manual stages and extra reviews, and with each manual stage the stages it replaced by being edited (`replaces_stage_id`, followed back), whose work it builds on. Manual stages a re-run kept are in the final pipeline, so they count.
  - If parts of a manual stage are ever kept item by item through a re-run (today it is kept or dropped as a whole), measuring its active work gets more complicated: the work of a kept part would sit in a stage no longer in the pipeline.
  - If projects are forked (the task "Forking a project"), a manual stage a fork shares with its original counts in both, each with the stage's whole work time and its own page count: what matters is the effort a new score needs.
- **Dropped (decided):** a "Re-runs" row and a "projects that needed a hand" share: a re-run isn't manual work (its cost is money, which Costs shows by kept or discarded), and the count was wrong anyway, since a manual fix in the middle replaces the stages after it. Counting how much each fix changed (boxes moved, answers given): active time covers every manual step with one rule, and hard changes take longer than easy ones.

## Active time

Counted in quarters of an hour everywhere (decided 2026-10-30): they fit every time zone (each zone's hours start on a quarter), and a quarter is small enough to tell a one-minute touch from real work, which whole hours (used at first) couldn't: 10 minutes counted as an hour.
- **A quarter is active if anything happened in it,** and active time is 15 minutes for each. A span (an LLM call) counts every quarter it touches, so a session is overestimated by less than 30 minutes, at its two ends.
- **Manual stages** (migration 0022, `apps/worker/src/activeTime.ts`): every save of a WIP stage's outputs adds one to its count for that quarter (`manual_saves`, a row per stage and quarter; single saves or minutes would fill the database for little gain; going finer later would be a migration that puts the counts at their quarters' first minutes). A quarter with a save is active, and so is a single quarter without one between two active ones (decided: 15 minutes without a save is still work, reading or thinking; longer is a break; for manual stages only, since elsewhere events are dense while work happens). The editors save as the user works: Fix skew and Fix layout every change at once, Fix MEI 2 s after typing stops and on closing or Apply, the forms when a field leaves edit mode, is confirmed or removed, and on closing.
- **Time in an open editor without saving** (reading longer than a quarter) isn't counted; whether it should be is undecided (the optional task "Heartbeats of manual stages being edited").

## Mock data

`npm run seed:stats` (`scripts/seedStats.ts`) writes five months of simulated use into a local database of its own, for every tab: projects, stages, calls with their costs and failures, a timed output for every item of an automatic stage (some answered from the record, some page images found on the device), manual stages' saves per quarter in sessions with pauses, an edited manual stage, a Fix MEI over several evenings. `npm run dev:worker -- --persist-to .wrangler/seed-stats` serves it.
