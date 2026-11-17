import { test } from "node:test";
import assert from "node:assert/strict";
import { hashHistory, type HashHistory, type NavWindow } from "./hashHistory.ts";

// A browser's session history, within one document: entries with a hash and a state, a position, and `hashchange`
// fired (later, as a task, as browsers do) when a traversal or a new entry changes the hash.
class FakeWindow implements NavWindow {
  entries: { hash: string; state: unknown }[];
  position = 0;
  private listeners: (() => void)[] = [];
  private queue: (() => void)[] = [];

  constructor(hash: string, state: unknown = null) {
    this.entries = [{ hash, state }];
  }

  get shown() {
    return this.entries[this.position];
  }

  private moveTo(position: number) {
    const before = this.shown.hash;
    this.position = position;
    if (this.shown.hash !== before) this.queue.push(() => this.listeners.forEach((listener) => listener()));
  }

  location = (() => {
    const win = this;
    return {
      get hash() {
        return win.shown.hash;
      },
      set hash(hash: string) {
        if (hash === win.shown.hash) return; // no new entry, no event
        win.entries.splice(win.position + 1, Infinity, { hash, state: null });
        win.moveTo(win.position + 1);
      },
    };
  })();

  history = (() => {
    const win = this;
    return {
      get state() {
        return win.shown.state;
      },
      go(delta: number) {
        const target = win.position + delta;
        if (delta === 0 || target < 0 || target >= win.entries.length) return; // outside the document: not modelled
        win.queue.push(() => win.moveTo(target));
      },
      back() {
        this.go(-1);
      },
      replaceState(state: unknown, _unused: string, url?: string) {
        win.entries[win.position] = { hash: url ?? win.shown.hash, state: structuredClone(state) };
      },
    };
  })();

  // What `location.replace(hash)` does: a new entry in place of the one shown, without a state.
  locationReplace(hash: string) {
    const before = this.shown.hash;
    this.entries[this.position] = { hash, state: null };
    if (hash !== before) this.queue.push(() => this.listeners.forEach((listener) => listener()));
  }

  addEventListener(_type: "hashchange", listener: () => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: "hashchange", listener: () => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  // Runs what the browser would run next, until nothing is left.
  settle() {
    while (this.queue.length > 0) this.queue.shift()!();
  }

  numbers() {
    return this.entries.map((entry) => (entry.state as { score3lyIndex?: number } | null)?.score3lyIndex);
  }
}

// The app over a fake window: the hash shown, and the question asked while `running` names a project.
function app(win: FakeWindow) {
  const state = { hash: win.location.hash, running: null as string | null, asked: null as (() => void) | null };
  const nav: HashHistory = hashHistory(win, {
    holds: (next) => state.running !== null && !next.startsWith(`#/projects/${state.running}`),
    ask: (proceed) => (state.asked = proceed),
    onHash: (hash) => (state.hash = hash),
  });
  nav.start();
  return { state, nav };
}

test("each entry is numbered by its position, a replaced one keeping its number", () => {
  const win = new FakeWindow("#/projects/a");
  const { state, nav } = app(win);
  nav.go("#/settings");
  win.settle();
  nav.replace("#/settings/configs");
  win.settle();
  assert.equal(state.hash, "#/settings/configs");
  assert.deepEqual(win.entries.map((e) => e.hash), ["#/projects/a", "#/settings/configs"]);
  assert.deepEqual(win.numbers(), [0, 1]);
});

test("a held step forward over a replaced entry is undone by one step, and Leave takes it (F1)", () => {
  // Project a, the Settings page, its configs tab (a replace), back to a, a run starts, then Forward.
  const win = new FakeWindow("#/projects/a");
  const { state, nav } = app(win);
  nav.go("#/settings");
  win.settle();
  nav.replace("#/settings/configs");
  win.settle();
  win.history.back();
  win.settle();
  assert.equal(state.hash, "#/projects/a");
  state.running = "a";
  win.history.go(1);
  win.settle();
  assert.ok(state.asked, "the question is asked");
  assert.equal(win.position, 0, "the history is back where it was");
  assert.equal(win.location.hash, "#/projects/a");
  assert.equal(state.hash, "#/projects/a", "the view stays on the project");
  state.asked!();
  win.settle();
  assert.equal(win.position, 1);
  assert.equal(state.hash, "#/settings/configs");
});

test("with location.replace, the replaced entry was taken for a new one, and the held step undone by two (F1, before)", () => {
  // What the app did before: the tabs replaced with location.replace. The entry then has no number, so it is
  // numbered one past the entry it replaced, and the step forward from a is taken for a step of 2.
  const win = new FakeWindow("#/projects/a");
  const { state, nav } = app(win);
  nav.go("#/settings");
  win.settle();
  win.locationReplace("#/settings/configs");
  win.settle();
  assert.deepEqual(win.numbers(), [0, 2]);
  win.history.back();
  win.settle();
  state.running = "a";
  win.history.go(1);
  win.settle();
  assert.equal(win.position, 1, "go(-2) from position 1 leaves the document: nothing happens");
  assert.equal(win.location.hash, "#/settings/configs", "the URL says the page while the view shows the project");
  assert.equal(state.hash, "#/projects/a");
});

test("a held step back over several entries is undone by as many steps", () => {
  const win = new FakeWindow("#/settings");
  const { state, nav } = app(win);
  nav.go("#/projects/a");
  win.settle();
  nav.go("#/projects/a/artifacts/pdf");
  win.settle();
  nav.go("#/projects/a/stages/s");
  win.settle();
  state.running = "a";
  win.history.go(-3);
  win.settle();
  assert.equal(win.position, 3);
  assert.equal(state.hash, "#/projects/a/stages/s");
  state.asked!();
  win.settle();
  assert.equal(win.position, 0);
  assert.equal(state.hash, "#/settings");
  assert.deepEqual(win.numbers(), [0, 1, 2, 3]);
});

test("a held new entry (a link, a hash typed in) is undone by going back, and made again on Leave", () => {
  const win = new FakeWindow("#/projects/a");
  const { state } = app(win);
  state.running = "a";
  win.location.hash = "#/about";
  win.settle();
  assert.equal(win.position, 0);
  assert.equal(state.hash, "#/projects/a");
  state.asked!();
  win.settle();
  assert.deepEqual(win.entries.map((e) => e.hash), ["#/projects/a", "#/about"]);
  assert.deepEqual(win.numbers(), [0, 1]);
  assert.equal(state.hash, "#/about");
});

test("navigate asks before leaving a running project, and goes only on Leave; a replace never asks", () => {
  const win = new FakeWindow("#/projects/a");
  const { state, nav } = app(win);
  state.running = "a";
  let arrived = false;
  nav.navigate("#/projects/b", () => (arrived = true));
  win.settle();
  assert.equal(state.hash, "#/projects/a");
  assert.equal(arrived, false);
  state.asked!();
  win.settle();
  assert.equal(state.hash, "#/projects/b");
  assert.equal(arrived, true);
  assert.deepEqual(win.numbers(), [0, 1]);

  state.asked = null;
  state.running = "b";
  nav.navigate("#/projects/b/artifacts/pdf"); // the same project: not held
  win.settle();
  nav.replace("#/");
  win.settle();
  assert.equal(state.asked, null);
  assert.equal(state.hash, "#/");
  assert.deepEqual(win.numbers(), [0, 1, 2]);
});

test("a reload keeps the entries' numbers; a fresh entry starts at 0", () => {
  const win = new FakeWindow("#/projects/a", { score3lyIndex: 4, other: true });
  const { state, nav } = app(win);
  nav.go("#/about");
  win.settle();
  assert.deepEqual(win.numbers(), [4, 5]);
  assert.deepEqual(win.entries[0].state, { score3lyIndex: 4, other: true });
  win.history.back();
  win.settle();
  state.running = "a";
  win.history.go(1);
  win.settle();
  assert.equal(win.position, 0, "held by one step");

  const fresh = new FakeWindow("");
  app(fresh);
  assert.deepEqual(fresh.numbers(), [0]);
});
