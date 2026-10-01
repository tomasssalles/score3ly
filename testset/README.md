# Test set

Input scores and their LilyPond extractions, compared by eye in the evaluation viewer.
See DESIGN.md §13 for the rationale.

## Files

| File | What it is |
|---|---|
| `<piece>.orig.pdf` | The input score. |
| `<piece>.<method>.ly` | LilyPond produced by one extraction method, e.g. `audiveris`, `s3l-gemini`. |
| `<piece>.<method>.pdf` | Engraving of that `.ly`, produced by the engrave command. |
| `<piece>.<file>.marks.json` | Highlighter strokes drawn in the viewer on `<piece>.<file>.pdf` (`<file>` is `orig` or a method). |

Only the README, the `*.orig.pdf` inputs, their highlighter strokes (`*.orig.marks.json`) and the `*.ly` candidates are committed (public-domain scores, e.g. from IMSLP).
Engravings, highlighter strokes on engravings and anything else produced here stay local (see `.gitignore`).

## Tooling

Run from the repository root:

```sh
npm run eval:engrave   # compile every .ly that has no PDF yet (never overwrites)
npm run eval:view      # open the side-by-side viewer at http://localhost:5174
```

Both are stubs for now. Engraving requires a local LilyPond install.

## Pieces

| Piece | Source | Why it's included |
|---|---|---|
