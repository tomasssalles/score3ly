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

## Batch 3

- **B5** (`checkMeiText` waits forever): held; the quick fix (an `error` listener and a 60 s handshake timeout, the worker dropped and made again at the next check). The shared worker client stays B20's (batch 23).
- **B15** (a failed Verovio load kept): held for a load that fails; a Verovio that loaded and aborted later (Emscripten's abort) still stays broken until a reload, which B20's client (reset on a worker error) covers.
- **B6, D6** (notes from this run's items only): held; done as planned, `runPlan` giving the note the stage's final outputs. Extract, review and apply_review weren't affected (they read their recorded outputs back before running).
- **D17** (closed token lists copied by hand): held as a risk, not a live bug: every token has its MEI today. Fixed so a new token is a type error; the MEI is byte-identical.
- **B17** (small geometry bugs): held. For `fixSkew`, the line is cut at the page's edges along its direction (keeping the drawn angle) rather than computing the angle after clamping the ends, which would have changed the angle the person drew.

## Batch 4

- **For the owner:** the Statistics page's first tab has two URLs (`#/stats` from the menu, `#/stats/costs` once a tab is clicked), while the Settings page's first tab has one (`#/settings`). Proposed (F11): the first tab without a suffix on both pages. Not made, since it changes a URL the user sees and isn't a bug; the tab functions are now one pair (`tabFromHash`, `hashForTab`), with the difference written down in route.ts (`FIRST_TAB_NAMED`), so the change is one line.
- **F1** (a replace breaks the numbering): held, confirmed in Chromium (an entry made by `location.replace` has a null state). Done as planned, with the numbering and the hold in a pure `hashHistory.ts` over an injected window (tested with a fake history), and the hook `useAppNavigation` in navigation.ts.
- **F11** (one navigation module): held. The pages get their tab and `onTab` from PageView rather than the hash by context. Changed: the first tab without a suffix on both pages not made (above).
- **F3** (the "doesn't exist" flash): held, seen in Chromium. The list is loaded before opening (the returned project isn't put in the list by hand: an import returns only its id and name). The pasted-link case (a check, minor) done too: one reload of the list before saying a project doesn't exist.
- **Dec. 43:** as recommended; the question comes after the known-PDF dialog (it is asked when the project is about to be made, not when the file is picked, so a cancelled file pick asks nothing).
