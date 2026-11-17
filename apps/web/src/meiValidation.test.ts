import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";

// The check worker is replaced by a fake that records what is made and sent, and answers only when told to.
class FakeWorker extends EventTarget {
  static made: FakeWorker[] = [];
  sent: unknown[] = [];
  terminated = false;
  constructor() {
    super();
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown) {
    this.sent.push(message);
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

const realWorker = globalThis.Worker;
globalThis.Worker = FakeWorker as unknown as typeof Worker;
const { checkMeiText, HANDSHAKE_MS } = await import("./meiValidation.ts");

afterEach(() => {
  mock.timers.reset();
});

test.after(() => {
  globalThis.Worker = realWorker;
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a check is answered once the worker listens", async () => {
  const checked = checkMeiText("<mei/>");
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ listening: true });
  await tick();
  assert.deepEqual(worker.sent, [{ id: 1, text: "<mei/>" }]);
  worker.say({ id: 1, problems: [] });
  assert.deepEqual(await checked, []);
});

test("a worker that fails rejects what waits, and the next check starts a new one", async () => {
  const before = FakeWorker.made.length;
  // The previous test's worker is still the one in use: it fails while a check waits.
  const worker = FakeWorker.made.at(-1)!;
  const checked = checkMeiText("<mei/>");
  await tick();
  worker.fail("boom");
  await assert.rejects(checked, /The MEI checks failed: boom/);
  const again = checkMeiText("<mei/>");
  assert.equal(FakeWorker.made.length, before + 1);
  const fresh = FakeWorker.made.at(-1)!;
  fresh.say({ listening: true });
  await tick();
  fresh.say({ id: (fresh.sent[0] as { id: number }).id, problems: [] });
  assert.deepEqual(await again, []);
  // And one that fails before it listens (its script couldn't be loaded).
  fresh.fail("");
  const third = checkMeiText("<mei/>");
  FakeWorker.made.at(-1)!.fail("");
  await assert.rejects(third, /The MEI checks couldn't start/);
});

test("a worker that never says it listens: the check fails after a while instead of waiting forever", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const checked = checkMeiText("<mei/>");
  const worker = FakeWorker.made.at(-1)!;
  mock.timers.tick(HANDSHAKE_MS);
  await assert.rejects(checked, /The MEI checks couldn't start/);
  assert.ok(worker.terminated);
});
