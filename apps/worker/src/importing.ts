// An import in progress (docs/database.md, "Exporting and importing a project"): the project is marked `importing` until
// its last rows are in. Until then it is hidden: from the project list (the home, the picker), a PDF's lookup (the
// known-PDF dialog), every statistics tab and the spending cap; and the cache never serves its stages or calls, so
// that removing it, if it never finishes, leaves nothing that refers to them. These fragments say which rows are its.

// The project in `column` isn't an import in progress (true for NULL).
export const notImportingProject = (column: string) => `NOT EXISTS (SELECT 1 FROM projects ip WHERE ip.id = ${column} AND ip.importing IS NOT NULL)`;

// The stage in `column` wasn't created by an import in progress (true for NULL: a config's test call).
export const notImportingStage = (column: string) =>
  `NOT EXISTS (SELECT 1 FROM stages ist JOIN projects ip ON ip.id = ist.created_in WHERE ist.id = ${column} AND ip.importing IS NOT NULL)`;
