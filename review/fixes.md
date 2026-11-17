# The fixes: findings dropped or changed

One line per finding that didn't hold as planned, or whose fix was done differently, at fix time (`review/plan.md`, "Be critical of the batch itself"): the finding, what was found, what was done instead.

## Batch 1

- **E18** (root scripts outside every check): held, but the new root typecheck found no type errors in `scripts/`. Also found: `apps/worker/model-list/gather/` (the model list's five gatherers) was in no typecheck either; added to the worker's `tsconfig.json`, clean.
- **E5** (`stopAll` returns at once): held. Waiting for each child's `exit` alone wasn't enough, since the child (npx) can end before what it started (workerd) lets go of the port; `stopAll` waits until the whole process group is gone (SIGKILL after 10 s).
- **E10** (arguments by hand): held, done in every script but the desktop's `main.ts`, whose `--dev-providers` stays `process.argv.includes`: Electron's argv carries Chromium's own switches, which a strict parse would refuse.

## Batch 2

- **C7** (small wrong texts): the Test's "unknown (unpriced)" for a config priced by the provider and the cap refusal's "$0.00" held and were fixed; **"incl. VAT" at 0 % didn't hold**: docs/llm.md ("VAT") has the owner's decision that costs include VAT always, "at 0% too, which may be a VAT ID's reverse charge", naming "$0.01 incl. VAT" in a Test's result. Kept as it is.
- **C3** (calls of unknown cost): held. The rule now reads the call alone (tokens and no cost, for any config that isn't free; a 524 among the no-token calls); one hand-made test row (a listed config's call with tokens and no cost, which `runCall` never writes) needed its cost.
- **C4** (the zombie limit): held. Margin 5 minutes; the constant in a new `callRecords.ts` with `UNKNOWN_COST`, where C24 (batch 13) will look for it.
- **C5** (rename offered to a numbered name): held; done as the owner decided (no rename dialog, one message), the text once in `@score3ly/core` for the Worker and the form. The "same name" message went too: the one message covers it.
- **C25** (itemTiming): held, the one-line fix. Calls an older item still makes while a newer one runs still count with the newer one (the module's header accepts the same for views).
