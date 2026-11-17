# The fixes: findings dropped or changed

One line per finding that didn't hold as planned, or whose fix was done differently, at fix time (`review/plan.md`, "Be critical of the batch itself"): the finding, what was found, what was done instead.

## Batch 1

- **E18** (root scripts outside every check): held, but the new root typecheck found no type errors in `scripts/`. Also found: `apps/worker/model-list/gather/` (the model list's five gatherers) was in no typecheck either; added to the worker's `tsconfig.json`, clean.
- **E5** (`stopAll` returns at once): held. Waiting for each child's `exit` alone wasn't enough, since the child (npx) can end before what it started (workerd) lets go of the port; `stopAll` waits until the whole process group is gone (SIGKILL after 10 s).
- **E10** (arguments by hand): held, done in every script but the desktop's `main.ts`, whose `--dev-providers` stays `process.argv.includes`: Electron's argv carries Chromium's own switches, which a strict parse would refuse.
