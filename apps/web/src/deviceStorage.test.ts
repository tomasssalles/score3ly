import assert from "node:assert/strict";
import { test } from "node:test";
import { DEVICE_KEYS, readDevice, rememberedValue, writeDevice } from "./deviceStorage.ts";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    store: () => ({
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    }),
  };
}

const throwing = () => ({
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
});

test("a value is kept, read back and removed", () => {
  const { map, store } = memory();
  assert.equal(readDevice(DEVICE_KEYS.theme, store), null);
  assert.equal(writeDevice(DEVICE_KEYS.theme, "light", store), true);
  assert.equal(map.get("score3ly.theme"), "light");
  assert.equal(readDevice(DEVICE_KEYS.theme, store), "light");
  assert.equal(writeDevice(DEVICE_KEYS.theme, null, store), true);
  assert.equal(map.has("score3ly.theme"), false);
});

test("storage that throws, or none, reads nothing and keeps nothing", () => {
  assert.equal(readDevice(DEVICE_KEYS.theme, throwing), null);
  assert.equal(writeDevice(DEVICE_KEYS.theme, "light", throwing), false);
  assert.equal(writeDevice(DEVICE_KEYS.theme, null, throwing), false);
  const accessorThrows = () => {
    throw new Error("SecurityError");
  };
  assert.equal(readDevice(DEVICE_KEYS.theme, accessorThrows), null);
  assert.equal(writeDevice(DEVICE_KEYS.theme, "x", accessorThrows), false);
  assert.equal(readDevice(DEVICE_KEYS.theme, () => undefined), null);
  assert.equal(writeDevice(DEVICE_KEYS.theme, "x", () => undefined), false);
  // In Node there is no localStorage: the default store is missing.
  assert.equal(readDevice(DEVICE_KEYS.theme), null);
});

test("a remembered toggle: the stored value if it is one of the values, else the initial one", () => {
  const { map, store } = memory();
  const values = ["shown", "hidden"] as const;
  assert.equal(rememberedValue(DEVICE_KEYS.meiScore, "shown", values, store), "shown");
  map.set("score3ly.mei.score", "hidden");
  assert.equal(rememberedValue(DEVICE_KEYS.meiScore, "shown", values, store), "hidden");
  map.set("score3ly.mei.score", "sideways");
  assert.equal(rememberedValue(DEVICE_KEYS.meiScore, "shown", values, store), "shown");
  assert.equal(rememberedValue(DEVICE_KEYS.meiScore, "shown", values, throwing), "shown");
});

test("the keys are the ones the app has always used (what a device remembers survives the change)", () => {
  assert.deepEqual(Object.values(DEVICE_KEYS).sort(), [
    "pipelinePanelCollapsed",
    "score3ly.fixLayout.marks",
    "score3ly.imageCacheMB",
    "score3ly.mei.score",
    "score3ly.theme",
    "score3ly.transcription.boxes",
    "score3ly.transcription.view",
  ]);
});
