import assert from "node:assert/strict";
import { test } from "node:test";
import { closesOnClick, onCancelEvent, onKeyDown, ownEvent, resultSlot } from "./dialogRules.ts";

function event(key = "") {
  let prevented = false;
  return {
    key,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
}

test("a busy dialog refuses Escape and the cancel event; an idle one doesn't", () => {
  for (const busy of [true, false]) {
    const cancel = event();
    onCancelEvent(busy, cancel);
    assert.equal(cancel.prevented, busy);
    const escape = event("Escape");
    onKeyDown(busy, escape);
    assert.equal(escape.prevented, busy);
  }
  // Other keys go on, typing in a field included.
  const enter = event("Enter");
  onKeyDown(true, enter);
  assert.equal(enter.prevented, false);
});

test("a click closes the dialog only on its backdrop, and not while busy", () => {
  const dialog = {};
  assert.equal(closesOnClick(false, dialog, dialog), true);
  assert.equal(closesOnClick(false, {}, dialog), false);
  assert.equal(closesOnClick(true, dialog, dialog), false);
  assert.equal(closesOnClick(false, null, null), false);
});

test("the result is read once; nothing set means cancelled", () => {
  const slot = resultSlot<"done">();
  assert.equal(slot.take(), undefined);
  slot.set("done");
  assert.equal(slot.take(), "done");
  assert.equal(slot.take(), undefined);
});

test("a nested dialog's events aren't the dialog's own", () => {
  const outer = {};
  const inner = {};
  assert.equal(ownEvent(outer, outer), true);
  assert.equal(ownEvent(inner, outer), false);
  assert.equal(ownEvent(null, null), false);
});
