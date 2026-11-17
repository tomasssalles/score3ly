// What the root's command-line tools share: their arguments, parsed strictly (an unknown flag, or a flag without its
// value, is refused before anything is done), and the rule for the folders they delete (review E10).

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";

// The arguments after the script's name, as `config` describes them (`node:util`'s `parseArgs`, always strict). On a
// mistake, prints it with `usage` and exits with 1.
export function scriptArgs<const T extends ParseArgsConfig>(config: T, usage: string, args = process.argv.slice(2)): ReturnType<typeof parseArgs<T>> {
  try {
    return parseArgs({ ...config, args, strict: true }) as ReturnType<typeof parseArgs<T>>;
  } catch (err) {
    console.error(`${err instanceof Error ? err.message : err}\n\n${usage}`);
    process.exit(1);
  }
}

// Whether a tool may delete `dir` and write it anew: it is `ownDefault` (the tool's fixed folder), or doesn't exist or
// is empty, or carries the tool's `marker` file (`markFolder`): never a folder an argument names by mistake (`.`, a
// parent, someone's own files). With `within`, it must also be inside that folder.
export function mayReplace(dir: string, marker: string, options: { ownDefault?: string; within?: string } = {}): string | null {
  const path = resolve(dir);
  if (options.within) {
    const rel = relative(resolve(options.within), path);
    if (rel === "" || rel.startsWith("..") || rel.startsWith(sep) || resolve(options.within, rel) !== path) {
      return `${dir} isn't inside ${options.within}`;
    }
  }
  if (options.ownDefault && path === resolve(options.ownDefault)) return null;
  if (!existsSync(path) || readdirSync(path).length === 0 || existsSync(join(path, marker))) return null;
  return `${dir} isn't empty and wasn't written by this tool (it has no ${marker}): not deleting it`;
}

// Marks `dir` as written by the tool, so that a later run may replace it (`mayReplace`).
export function markFolder(dir: string, marker: string) {
  writeFileSync(join(dir, marker), "Written by a score3ly tool, which may delete this folder and write it anew.\n");
}
