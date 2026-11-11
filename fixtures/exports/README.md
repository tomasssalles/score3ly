# Historical exports

Project files (`.s3l`, a plain zip) exported by earlier versions of score3ly, one or more per export format
(docs/database.md, "Exporting and importing a project"). A test imports each one (`apps/worker/src/index.test.ts`),
so that a change that can no longer read an old format fails there, not in a user's import: then either the import
learns to read it, or the format's version goes up and the old files stay refused with a message.

- `format-1-bach-fake.s3l`: format 1, the Bach prelude (`testset/`) run with the fake model in Auto mode, its Engrave
  failed (exported as it was; a stage in every other state is done). Made by the app at commit 40708c3.

Add a file here whenever the export format changes, made by the app at that commit.
