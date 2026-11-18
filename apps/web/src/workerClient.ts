// The app's Web Workers (page images, renderings, the MEI checks) and the page talk through one small protocol, written
// once here: `workerClient` on the page's side, `serve` in the worker.
//
// - A worker says when it listens (`{ listening: true }`), and is sent nothing before: a worker whose module loads
//   something with a top-level await (libxml2) would lose a message that arrives before the module has run.
// - Each request carries an id and gets one answer with the same id: its response, or its error as text.
// - A worker that fails (it couldn't load, an error escaped it, a message couldn't be read, it never said it
//   listens, or it answered that it is broken) is terminated, everything waiting for it fails, and the next request
//   starts a new one. A worker is broken when a WebAssembly module in it trapped or aborted (Emscripten's `abort`
//   throws a `WebAssembly.RuntimeError` and leaves the module unusable): Verovio and libxml2 are such modules.
//
// What a worker answers is typed by a map of its calls, `{ [type]: { request, response } }`, shared by import.

import { errorText } from "@score3ly/core";

export type Calls = Record<string, { request: unknown; response: unknown }>;

type Sent = { id: number; type: string; request: unknown };
type Answer = { listening: true } | { id: number; response: unknown } | { id: number; error: string; fatal: boolean };

export type WorkerClientOptions = {
  // The text of a failure of the worker itself: `detail` is the browser's message, if any; `started` says whether the
  // worker had said it listens.
  failure: (detail: string | undefined, started: boolean) => string;
  // How long the worker may take to say it listens; no limit if not given.
  handshakeMs?: number;
  // The text when it took longer.
  handshakeFailure?: string;
  // Called when a worker is dropped (whatever it held is gone with it).
  onReset?: () => void;
};

export type WorkerClient<C extends Calls> = {
  ask<K extends keyof C & string>(type: K, request: C[K]["request"], transfer?: Transferable[]): Promise<C[K]["response"]>;
  // Starts the worker ahead of the first request (it loads what it needs then).
  start(): void;
};

type Pending = { resolve: (response: unknown) => void; reject: (error: Error) => void };

// `create` makes the worker: Vite bundles a worker only from a literal `new Worker(new URL("./x.ts", import.meta.url))`
// at the call site, so the client takes a factory, not a URL.
export function workerClient<C extends Calls>(create: () => Worker, options: WorkerClientOptions): WorkerClient<C> {
  let worker: Promise<Worker> | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  function getWorker(): Promise<Worker> {
    if (worker) return worker;
    let started = false;
    let created: Worker | null = null;
    const made: Promise<Worker> = new Promise((listening, failed) => {
      const fail = (error: Error) => {
        clearTimeout(timer);
        created?.terminate();
        for (const waiting of pending.values()) waiting.reject(error);
        pending.clear();
        if (worker === made) {
          worker = null;
          options.onReset?.();
        }
        failed(error);
      };
      const timer =
        options.handshakeMs === undefined
          ? undefined
          : setTimeout(() => fail(new Error(options.handshakeFailure ?? options.failure(undefined, false))), options.handshakeMs);
      try {
        created = create();
      } catch (err) {
        return fail(new Error(options.failure(errorText(err), false)));
      }
      created.addEventListener("message", (event: MessageEvent<Answer>) => {
        const answer = event.data;
        if ("listening" in answer) {
          started = true;
          clearTimeout(timer);
          return listening(created!);
        }
        const waiting = pending.get(answer.id);
        if (!waiting) return;
        pending.delete(answer.id);
        if (!("error" in answer)) return waiting.resolve(answer.response);
        waiting.reject(new Error(answer.error));
        // A broken worker: whatever else waits for it fails with the same error, and the next request starts a new one.
        if (answer.fatal) fail(new Error(answer.error));
      });
      created.addEventListener("error", (event: Event) => {
        const message = (event as ErrorEvent).message;
        fail(new Error(options.failure(message || undefined, started)));
      });
      created.addEventListener("messageerror", () => {
        fail(new Error(options.failure("an answer of the worker couldn't be read", started)));
      });
    });
    made.catch(() => {}); // a failure reaches the requests that wait; `start` doesn't
    worker = made;
    return made;
  }

  return {
    async ask(type, request, transfer = []) {
      const ready = await getWorker();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as (response: unknown) => void, reject });
        ready.postMessage({ id, type, request } satisfies Sent, transfer);
      });
    },
    start() {
      void getWorker();
    },
  };
}

// The worker's side, typed by the same map: a handler per type of request.
export type Handlers<C extends Calls> = { [K in keyof C]: (request: C[K]["request"]) => Promise<C[K]["response"]> | C[K]["response"] };

// What `serve` needs of the worker's global scope (a parameter, so that tests can pass their own).
export type WorkerScope = {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

// Answers every request with its handler's response (`transfer` names what is moved rather than copied), or its error,
// and says that the worker listens. Call it last in the worker's module, once everything is loaded.
export function serve<C extends Calls>(
  handlers: Handlers<C>,
  transfer: (response: C[keyof C]["response"]) => Transferable[] = () => [],
  scope: WorkerScope = self as unknown as WorkerScope,
): void {
  scope.addEventListener("message", async (event: MessageEvent<Sent>) => {
    const { id, type, request } = event.data;
    try {
      const response = await handlers[type as keyof C](request as C[keyof C]["request"]);
      scope.postMessage({ id, response } satisfies Answer, transfer(response));
    } catch (err) {
      scope.postMessage({ id, error: errorText(err), fatal: err instanceof WebAssembly.RuntimeError } satisfies Answer);
    }
  });
  scope.postMessage({ listening: true } satisfies Answer);
}

// One making per key at a time: a second request for what is being made waits for the first instead of making it
// again (two views and a running stage asking for the same image, or the same rendering).
export function oneAtATime<T>(): (key: string, make: () => Promise<T>) => Promise<T> {
  const making = new Map<string, Promise<T>>();
  return (key, make) => {
    const running = making.get(key);
    if (running) return running;
    const made = make().finally(() => {
      if (making.get(key) === made) making.delete(key);
    });
    making.set(key, made);
    return made;
  };
}
