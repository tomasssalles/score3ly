# Historical exports

Project files (`.s3l`, a plain zip) exported by earlier versions of score3ly, one or more per export format
(docs/database.md, "Exporting and importing a project"). A test imports each one of the current format (`apps/worker/src/index.test.ts`),
so that a change that can no longer read it fails there, not in a user's import: then either the import learns to
read it, or the format's version goes up and the old files stay refused with a message, which the same test checks.

- `format-1-bach-fake.s3l`: format 1, the Bach prelude (`testset/`) run with the fake model in Auto mode, its Engrave
  failed (exported as it was; a stage in every other state is done). Made by the app at commit 40708c3. Refused since
  format 2 (no reader for older formats).
- `format-1-fake.s3l`: format 1, the replay tests' fixture of the fake model as it was until batch 32 of the code
  review remade it (made by the app at commit 6398257). Refused since format 2; the web app's snapshot guards read it
  (`apps/web/src/testing/fixture.ts`), since they hash its ids.
- `format-2-fake.s3l`: format 2 (calls served from the record have rows of their own, `served_from`; every call has
  its place), the replay tests' fixture of the fake model (`npm run fixture:fake`), made by the app at the commit that
  added it (the code review's batch 32).

Add a file here whenever the export format changes, made by the app at that commit.
