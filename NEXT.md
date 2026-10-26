# Next steps (temporary list: delete it once its items are done or moved into DESIGN.md)

Written for the next session. Read DESIGN.md first, as usual. Work happens on the branch given by the session; fast-forward
main only when the project owner asks. The project owner decides the order; these are the items they listed, with what
is known about each.

## 3. Showing that the pipeline is moving while the user looks at an artifact
- **Decided:** the artifact view **stays** on what the user picked when a new stage finishes (it already follows the
  pipeline only while nothing is picked: `defaultArtifactId` in `pipeline.ts`, used in `ProjectView.tsx`). Close the
  task "Decide whether the artifact view follows the pipeline while it runs" (§15) and update §5.6 (the sentence "Whether
  the view follows the pipeline while it runs is still to be decided").
- **Today:** the running stage's card has a progress bar (only on the device that runs it). The panel's head
  (`PipelinePanel.tsx`) has only the pipeline's bar, no stage name. The collapsed strip (`ProjectView.tsx` ~line 448)
  has two rings labelled just "Pipeline" and "Stage" (the stage ring only while this device runs a stage).
- **Options to discuss and pick (owner undecided):** the running stage's name in the panel's head; in the collapsed
  strip too, or the stage's icon there if names don't fit (icons per step: `STEP_ICONS` in `StageCard.tsx`); a small,
  dismissable hint in the artifact view when a new result is ready ("Layout is ready · Show"). Show screenshots at both
  widths before deciding.
- **Decided so far (2026-10-25, from mock-ups):**
  - Collapsed strip: the running stage's **name** replaces the label "Stage" under its ring (two rows at most, cut with
    "…" beyond). A failed stage that stopped the pipeline: the ring is replaced by a **red** warning triangle
    (`--danger`), the stage's name under it.
  - **Toasts only in narrow mode while an artifact (or a stage's details) covers the pipeline**; none in wide mode, none
    on the narrow pipeline view. E.g. "Layout done. Starting Analyze", "Layout failed. Pipeline stopped". They
    disappear on their own and may cover the item counter in the corner.
  - `apply_review`'s title is **"Apply review"** (update DESIGN.md's table of steps, which says "Apply review results").
  - Expanded panel's head: the stage's name **below** the pipeline bar, in muted text with an ellipsis while it runs
    ("Analyze…"); in red without one if it failed ("Layout failed"). The row's height doesn't change.
  - `skew_analysis`'s title is **"Skew detection"** (fits the strip in two rows).
  - **The states when nothing runs on this device** (decided 2026-10-25, from mock-ups):
    - **Pipeline done:** head: "Done" under the full bar. Strip: no stage ring or label; a green check inside the
      (full, green) pipeline ring.
    - **Failed:** head: "Layout failed" in red, no ellipsis. Strip: the red triangle with the stage's name. **Interrupted**
      (the app was closed while it ran) is a failure, worded "Layout interrupted".
    - **Waiting for the user** (a stage not started yet in Manual mode, the first run in Auto mode, a stopped stage, a
      WIP manual stage): head: "Layout (not started)" or "Fix layout (WIP)" in muted text, no ellipsis (a manual stage
      is created WIP, so it is never "not started"). Strip: instead of the stage's ring, an empty ring with a **grey**
      pause sign inside, the stage's name under it. No toasts.
    - **Running on another device:** the same labels and toasts as running here; the strip shows a **spinner, its arc
      grey** (it turns; this device doesn't know the stage's progress), instead of the stage's ring.
    - A carried manual stage waiting for its turn: nothing to show (it is resolved by itself).
    - The longest labels fit the head on one line ("Skew detection interrupted", "Skew detection (not started)").
  - **Toasts** (narrow mode, an artifact open; the same whichever device runs the stage), for events the user didn't
    trigger at that moment (decided 2026-10-26; exact texts proposed, to confirm):
    - A stage finished and the next started (Auto): "Layout done. Starting Analyze".
    - A stage finished, the next waits for Run (Manual): "Layout done. Analyze is next".
    - The pipeline reached a WIP manual stage and waits (e.g. one carried through a re-run, Auto): "Layout done. Fix
      layout is waiting for you".
    - Failed: "Layout failed. Pipeline stopped". Interrupted (mostly a stage on another device whose heartbeat stopped;
      no toast on opening the app): "Layout interrupted. Pipeline stopped".
    - A carried manual stage dropped at its turn: "Fix skew dropped: inputs have changed".
    - The pipeline finished: "Pipeline done" (or "Pipeline done. The MEI is ready").
    - Not toasted: the failure's reason (it is on the card), app errors, anything the user just did.
  - Manual stages can't be planned ahead (added only after a done stage) and that stays so (decided): Manual mode covers
    it, and manual fixes should be the rare extra effort, not routine.
  - Mock-ups: `progress-mockups.patch` in the session's scratchpad (a `mock` key in localStorage), if still there.
