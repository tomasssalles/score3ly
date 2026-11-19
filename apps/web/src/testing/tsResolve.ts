// A module resolution hook for tests in Node (node:module `register`): the app's modules import each other without
// an extension ("./api"), as Vite resolves them; Node needs the file's. An extensionless relative import that Node
// can't find is tried again with ".ts", then ".tsx". Only the tests that load the stages' runners use it.

type Resolved = { url: string; format?: string | null; shortCircuit?: boolean };
type NextResolve = (specifier: string, context: unknown) => Promise<Resolved>;

export async function resolve(specifier: string, context: unknown, next: NextResolve): Promise<Resolved> {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!/^\.\.?\//.test(specifier) || /\.[a-z]+$/i.test(specifier)) throw err;
    for (const extension of [".ts", ".tsx"]) {
      try {
        return await next(specifier + extension, context);
      } catch {
        // the next extension
      }
    }
    throw err;
  }
}
