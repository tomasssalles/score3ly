# Next steps (temporary list: delete it once its items are done or moved into DESIGN.md)

Written for the next session. Read DESIGN.md first, as usual. Work happens on the branch given by the session; fast-forward
main only when the project owner asks. The project owner set this order (2026-10-26).

## 3. CI on GitHub Actions, on main only
- Run `npm test` and the typechecks of every workspace on pushes to **main only** (not on the working branches).
  Needed for the README's "tests passing" badge (task "Rewrite the README", §15).

## 4. `review`
- DESIGN.md §6 (`review`, "The Transcription", the issues) and the first-release list (§16). Includes what is left of
  the linking code that `review` needs (§15, "The linking code, what is left").

## 5. `apply_review`
- DESIGN.md §6 (`apply_review`; its title in the app is "Apply review"). Further reviews and their `apply_review`
  are carried and dropped like manual stages; an `apply_review` goes with its review; the recipe's review can't be
  dropped (§5.5).

## 6. `human_review`
- DESIGN.md §6 (`human_review`): a manual stage, never in the recipe, added by the user; an `apply_review` is added
  after it automatically and is dropped with it (§5.5).

## 7. Cost statistics
- The costs view (DESIGN.md §10; first-release list, §16; the Statistics page is a placeholder today).

## 8. Other statistics: decide, then build
- Ideas from the project owner: run times; how often the app and its stages are used; errors; how often manual fixes
  are needed, and how much each one changes (e.g. the number of boxes, lines or answers changed within a fix).
