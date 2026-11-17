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

## Batch 5

- **F2** (Escape while busy): held, seen in Chromium (Escape while a delete was on its way: the project deleted, the app left on its URL, no banner). The shell's `busy` refuses the `cancel` event and Escape's keydown and disables × and the backdrop; Delete and Export already disabled × and Cancel, Rename and NewModelConfig now do too while their request is on its way (a fix of the same bug, visible only for that moment). TestConfigDialog isn't made busy: closing it while its request runs loses nothing but an answer the user chose not to wait for (the request isn't aborted, C16, a later batch).
- **New, found here:** React passes a nested dialog's `close` and `cancel` on to the dialogs around it in its own tree (the browser doesn't), so cancelling or confirming the "Are you sure?" inside "Clone model config" closed the whole form (seen in Chromium; confirming went on creating, unmounted, any refusal lost). The shell acts only on its own events, and the confirmation is now rendered beside the form.
- **F12's dialog part:** done (`useDialog`/`Dialog`, `useId` titles, the result through `close(result)`). The duplicate `confirm-title` (two ConfirmDialogs open at once) is gone with the `useId` ids; not seen happen.
- **C15** (partial changes after a failure in NewModelConfig): held, narrower than written: batch 2 (C5) removed the rename → default → delete chain, so only "created, then making it the default failed" was left. The list is now reloaded once the config exists, and the dialog stays open with '"<name>" was created, but making it the default failed: <error>' (`createConfig` in configForm.ts, tested). The "Esc mid-create loses the error" part is F2's.
- **For the owner:** KnownPdfDialog's × is its own inline SVG (a 20-unit viewBox), drawn a little bolder than the `CloseIcon` of the seven other dialogs. Kept as it is (`closeIcon` passed to the shell), since unifying it changes how the dialog looks; one line to change, with F12's icons (batch 25). **Approved by the owner (2026-11-17); done in batch 6:** the dialog uses the shell's `CloseIcon`, and the shell's `closeIcon` prop is gone.


## Batch 6

- **F4** (durations "1 min 60 s"): held, reproduced (59.6 s → "60 s", 119.6 s → "1 min 60 s", 3599.6 s → "59 min 60 s"; also 9.96 s → "10.0 s"). Fixed by rounding to each form's precision first (`statDuration`, tested at the edges). Changed: **not one format**: the statistics', the cards' and the Test's durations keep their forms.
- **For the owner:** three duration formats on screen: the cards' and stage details' "3min 12s" / "1h 5min" (style.md's), the statistics' "3 min 12 s" / "0.4 s" / "3 d 4 h" (spaced, with tenths and days, which style.md doesn't have), and a config Test's "12.3 s". Proposed (F4): one format, e.g. style.md's with tenths below 10 s and days. Not made: it changes texts the user sees; style.md and the statistics disagree today, so one of them should change.
- **For the owner:** `ago` rounds hours and days, so 6.6 days reads "7d ago" (still under `when`'s week, then a date). Proposed: days floored ("6d ago"). Not made: a rounding, not a wrong value.
- **F14** (formatting module): held, done (`format.ts`: `count`/`plural`, `percent`, `formatSize`, `MONTHS` once, `fullDate`, the deleted/ended notes, `ago`/`when`/`shortDate`, `duration`, `statDuration`; `calendar.ts` out of costs.ts). Texts kept: pricing.ts' one-decimal fee percentage stays apart (`feePercent`, "5.5%") from the whole `percent`; four sentences whose plural isn't a count of the word ("lines on 2 of 3 pages", "it"/"them") stay as written. Two bugs found on the way: ObservationsView said "1 staves" for a system of one staff, and its form "2 staffs" beside the view's "2 staves" (now `count(n, "staff", "staves")`, the plan's "staffs → staves"); `formatSize` said "1000 MB" between 999.5 and 1000 MB (now "1.0 GB"). Dead `STEP_TITLES` and costs.ts' `STEPS` left to A9 (step facts, batch 15), as the note says.
- **C27** (money formatters): held, done. The two settings fields are one `NumberField`; the two `SpendingCap`s are `SpendingCapField` (settings) and `SpendingCapMeter` (Costs).
- **F6** (CSS tests guard nothing): held, reproduced (the 2026-11-02 regression passed). A small reader of our own (`cssRules.ts`, tested) rather than postcss as a devDependency, for four tests; each test now fails when its rule isn't found.
- **F8** (the head's state cut at its end): held as a rule; the state is a one-line `FittedText` (cut in the middle). Not seen cut at the widths and states the screenshots have.
- **F9** (the home's spinner): held; it is the app's `.spinner`, smaller: grey (dec. 44) and slowed with reduced motion.
- **F10** (small UI bugs): TimeChart's tap start held, reproduced in a test of the extracted `tapTracker`; the running total a loop. Filmstrip's focus held (latent), fixed by a ref. `createdBefore` held, reproduced (29.5 days old removed by "more than 30 days ago"): the cut-off is now that long before now. `pruneNow`'s rejection held, one chain. **For the owner:** the Pickers' accessible names (the picked value not in the button's name) not changed, since what a screen reader says is user-facing; a value in the name and `menuitemradio` proposed with batch 25's Picker.
- **A27** (`errorText.test.ts` misses PdfView): held; the error has `pdf-error error-text`, which the test checks. Its `String(e)` ("Error: HTTP 404") is batch 9's error contract.

## Batch 7

- **A5** (`canonicalJson` writes invalid JSON): held, reproduced (`[1, undefined, f, 3]` → `[1,,,3]`, `{f}` → `{"f":undefined}`, top-level `undefined` → `undefined` typed as a string). Fixed as JSON does (null in arrays, left out of objects); a top-level value JSON can't write is refused with a TypeError instead of being written as `null`: `keyOf(undefined)` hashed "" before, and no caller passes one. `toJSON` and typed arrays not honoured: the comment says "plain JSON values only". Keys of valid JSON byte-identical (snapshots of valid JSON of every kind, the fixture's requests, the stage keys, the Worker's request keys and recorded request hashes, a fingerprint, all taken before the change; the replay unchanged).
- **A22, B25** (copies): held. Changed: the `Fingerprint` type isn't moved here: batch 8's scope has `core/api/fingerprint.ts`. leipzig.ts' sync hash renamed `sha256OfBuffer`; the desktop's R2 stand-in keeps Node's sync `createHash` (it must hash synchronously inside `put`, like R2's own check).
- **E3** (numbered names over 200 characters): held, reproduced (renaming to the "… (1)" a 200-character file name gets was refused by the Worker and the web's dialog). Done as the owner decided (one " (n)" of 1 to 3 digits not counted, one rule in core for projects and configs, the test over every listed model's default name). Also: `firstFreeName` cuts a base over the limit itself (the import no longer cuts a valid numbered name before numbering it), and from " (1000)" on cuts its stem so the number fits.
- **D23/F16's `items.ts`:** held. A malformed system item now reads as system 1 in `engrave.ts` and steps.ts (it read as NaN when the part after "/s" wasn't a number); the app writes no such item.
- **`roundUsd`** (C24): held, four copies (`costOf`, `providerCost`, the run report, seedStats) on it. Also the Worker's `capAmount` and the web's `amount` were the same function: one `amount` in core money.ts.
