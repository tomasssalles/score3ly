import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { oneAtATime, serve, workerClient, type WorkerScope } from "./workerClient.ts";

// A fake Worker: records what it is sent, answers only when told to; or, connected to a fake worker scope, runs
// `serve` on the other side.
class FakeWorker extends EventTarget {
  sent: { id: number; type: string; request: unknown }[] = [];
  terminated = false;
  scope?: FakeScope;
  postMessage(message: { id: number; type: string; request: unknown }) {
    this.sent.push(message);
    this.scope?.dispatchEvent(new MessageEvent("message", { data: message }));
  }
  terminate() {
    this.terminated = true;
  }
  say(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  fail(message: string) {
    const event = new Event("error") as Event & { message: string };
    event.message = message;
    this.dispatchEvent(event);
  }
}

class FakeScope extends EventTarget {
  worker: FakeWorker;
  constructor(worker: FakeWorker) {
    super();
    this.worker = worker;
    worker.scope = this;
  }
  postMessage(message: unknown) {
    queueMicrotask(() => this.worker.say(message));
  }
}

type TestCalls = { echo: { request: string; response: string }; twice: { request: number; response: number } };

const tick = () => new Promise((resolve) => setImmediate(resolve));

function client(options: { handshakeMs?: number } = {}) {
  const made: FakeWorker[] = [];
  let resets = 0;
  const c = workerClient<TestCalls>(
    () => {
      const worker = new FakeWorker();
      made.push(worker);
      return worker as unknown as Worker;
    },
    {
      failure: (detail, started) => `${started ? "It failed" : "It couldn't start"}${detail ? `: ${detail}` : "."}`,
      handshakeFailure: "It didn't answer.",
      onReset: () => resets++,
      ...options,
    },
  );
  return { c, made, resets: () => resets };
}

afterEach(() => mock.timers.reset());

test("requests are sent once the worker listens, and answered by their ids", async () => {
  const { c, made } = client();
  const first = c.ask("echo", "a");
  const second = c.ask("twice", 2);
  await tick();
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].sent, []);
  made[0].say({ listening: true });
  await tick();
  assert.deepEqual(made[0].sent, [
    { id: 1, type: "echo", request: "a" },
    { id: 2, type: "twice", request: 2 },
  ]);
  made[0].say({ id: 2, response: 4 });
  made[0].say({ id: 1, error: "no", fatal: false });
  assert.equal(await second, 4);
  await assert.rejects(first, /^Error: no$/);
  // An error answer that isn't fatal keeps the worker.
  const third = c.ask("echo", "b");
  await tick();
  made[0].say({ id: 3, response: "b" });
  assert.equal(await third, "b");
  assert.equal(made.length, 1);
  assert.equal(made[0].terminated, false);
});

test("a worker that fails rejects everything that waits, is terminated, and the next request starts a new one", async () => {
  const { c, made, resets } = client();
  const first = c.ask("echo", "a");
  made[0].say({ listening: true });
  await tick();
  const second = c.ask("echo", "b");
  await tick();
  made[0].fail("boom");
  await assert.rejects(first, /It failed: boom/);
  await assert.rejects(second, /It failed: boom/);
  assert.ok(made[0].terminated);
  assert.equal(resets(), 1);
  const again = c.ask("echo", "c");
  assert.equal(made.length, 2);
  made[1].say({ listening: true });
  await tick();
  made[1].say({ id: made[1].sent[0].id, response: "c" });
  assert.equal(await again, "c");
  // One that fails before it listens (its script couldn't be loaded).
  made[1].fail("");
  const third = c.ask("echo", "d");
  made[2].fail("");
  await assert.rejects(third, /It couldn't start\./);
});

test("an answer that can't be read fails the worker instead of leaving its request waiting", async () => {
  const { c, made } = client();
  const asked = c.ask("echo", "a");
  made[0].say({ listening: true });
  await tick();
  made[0].dispatchEvent(new MessageEvent("messageerror"));
  await assert.rejects(asked, /It failed: an answer of the worker couldn't be read/);
  assert.ok(made[0].terminated);
});

test("a worker that never says it listens fails after a while", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { c, made } = client({ handshakeMs: 1000 });
  const asked = c.ask("echo", "a");
  mock.timers.tick(1000);
  await assert.rejects(asked, /It didn't answer\./);
  assert.ok(made[0].terminated);
});

test("a fatal answer (a broken WebAssembly module) fails what waits and replaces the worker", async () => {
  const { c, made, resets } = client();
  const first = c.ask("echo", "a");
  const second = c.ask("echo", "b");
  made[0].say({ listening: true });
  await tick();
  made[0].say({ id: 1, error: "Aborted(oops)", fatal: true });
  await assert.rejects(first, /Aborted\(oops\)/);
  await assert.rejects(second, /Aborted\(oops\)/);
  assert.ok(made[0].terminated);
  assert.equal(resets(), 1);
  void c.ask("echo", "c");
  assert.equal(made.length, 2);
});

test("serve answers with the handlers, says it listens, and marks a WebAssembly trap as fatal", async () => {
  const made: FakeWorker[] = [];
  const transferred: unknown[] = [];
  const c = workerClient<TestCalls>(
    () => {
      const worker = new FakeWorker();
      made.push(worker);
      const scope = new FakeScope(worker);
      const post = scope.postMessage.bind(scope);
      scope.postMessage = (message: unknown, transfer?: Transferable[]) => {
        transferred.push(...(transfer ?? []));
        post(message);
      };
      serve<TestCalls>(
        {
          echo: async (text) => {
            if (text === "trap") throw new WebAssembly.RuntimeError("Aborted(trap)");
            if (text === "bad") throw new Error("bad text");
            return text;
          },
          twice: (n) => n * 2,
        },
        (response) => (response === "move" ? [new ArrayBuffer(1)] : []),
        scope as unknown as WorkerScope,
      );
      return worker as unknown as Worker;
    },
    { failure: (detail) => `failed: ${detail}` },
  );
  assert.equal(await c.ask("echo", "hello"), "hello");
  assert.equal(await c.ask("twice", 21), 42);
  assert.equal(await c.ask("echo", "move"), "move");
  assert.equal(transferred.length, 1);
  await assert.rejects(c.ask("echo", "bad"), /^Error: bad text$/);
  assert.equal(made.length, 1);
  await assert.rejects(c.ask("echo", "trap"), /Aborted\(trap\)/);
  assert.ok(made[0].terminated);
  assert.equal(await c.ask("echo", "fresh"), "fresh");
  assert.equal(made.length, 2);
});

test("oneAtATime: a second request for what is being made waits for the first; once made, it is made again", async () => {
  const making = oneAtATime<string>();
  let made = 0;
  let finish!: (value: string) => void;
  const make = () => {
    made++;
    return new Promise<string>((resolve) => (finish = resolve));
  };
  const a = making("k", make);
  const b = making("k", make);
  assert.equal(made, 1);
  finish("x");
  assert.deepEqual(await Promise.all([a, b]), ["x", "x"]);
  const c = making("k", make);
  assert.equal(made, 2);
  finish("y");
  assert.equal(await c, "y");
  // A failure isn't kept either.
  const failing = making("f", () => Promise.reject(new Error("no")));
  await assert.rejects(failing, /no/);
  assert.equal(await making("f", async () => "yes"), "yes");
});
