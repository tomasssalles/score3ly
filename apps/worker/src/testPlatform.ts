import { join } from "node:path";
import { getPlatformProxy } from "wrangler";

// Wrangler's local D1 and R2 for the tests, kept in memory. Without the developer's secrets: Wrangler would read them
// from .dev.vars, unless it is given env files to read instead, and a file that doesn't exist is skipped. So tests
// never see real keys, and pass the same with or without a .dev.vars.
export function testPlatform() {
  return getPlatformProxy<Env>({ configPath: join(import.meta.dirname, "..", "wrangler.jsonc"), persist: false, envFiles: ["no-such-file"] });
}
