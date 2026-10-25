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
  - **Undecided:** the stage's name over the pipeline bar in the expanded panel's head (it may read as that stage's
    progress); `skew_analysis`'s title: "Skew detection" or "Skew" (instead of "Skew analysis").
  - Mock-ups: `progress-mockups.patch` in the session's scratchpad (a `mock` key in localStorage), if still there.
