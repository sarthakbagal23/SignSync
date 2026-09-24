// Tests for the capture sample store (§8 capture tool): rounding, per-letter
// counts, localStorage persistence, JSON export payload, quota-failure
// behavior, and corruption recovery.

import test from "node:test";
import assert from "node:assert/strict";

import { createStore, LETTERS, TARGET_PER_LETTER } from "./store.js";

function fakeStorage(initial = "{}") {
  const s = {
    value: initial,
    getItem: (k) => (k in s.data ? s.data[k] : null),
    setItem(k, v) {
      if (s.failing) throw new Error("QuotaExceededError");
      s.data[k] = String(v);
    },
    removeItem(k) {
      delete s.data[k];
    },
    data: {},
    failing: false,
  };
  if (initial !== null) s.data["signsync.capture.v1"] = initial;
  return s;
}

const sample = {
  t: 123.456789,
  label: "Left",
  scale: 1.02345678,
  landmarks: [[0.123456789, -0.987654321, 0.05], [-0.000049999, 1, 2]],
  features: {
    curl: { index: 0.123456789, middle: 0.2, ring: 0.3, pinky: 0.4 },
    spread: { indexMiddle: 0.555555, middleRing: 0.666666, ringPinky: 0.777777 },
    crossing: { indexLateral: -0.2861234, middleLateral: 0.2954321, isCrossed: false },
    thumb: {
      tipDist: { index: 0.111111, middle: 0.222222, ring: 0.333333, pinky: 0.444444 },
      pipDist: { index: 0.1, middle: 0.2, ring: 0.3, pinky: 0.4 },
      mcpDist: { index: 0.51, middle: 0.52, ring: 0.53, pinky: 0.54 },
      signedNormal: -0.43218765,
      lateral: 0.2951234,
    },
    orientation: {
      pointing: [0.123456, 0.654321, 0.111111],
      palmFacing: [0.999999, -0.000012, 0.000034],
    },
  },
};

test("LETTERS is the 26-letter alphabet and TARGET_PER_LETTER is 30", () => {
  assert.equal(LETTERS.length, 26);
  assert.equal(LETTERS[0], "A");
  assert.equal(LETTERS[25], "Z");
  assert.equal(TARGET_PER_LETTER, 30);
});

test("a fresh store has zeroed counts for all letters", () => {
  const store = createStore({ storage: fakeStorage() });
  const counts = store.counts();
  assert.deepEqual(Object.keys(counts), LETTERS);
  assert.ok(Object.values(counts).every((n) => n === 0));
  assert.equal(store.all().length, 0);
});

test("add stores values rounded to 4 decimal places", () => {
  const store = createStore({ storage: fakeStorage() });
  const stored = store.add("A", sample);

  assert.equal(stored.t, 123.4568);
  assert.equal(stored.scale, 1.0235);
  assert.deepEqual(stored.landmarks[0], [0.1235, -0.9877, 0.05]);
  assert.equal(stored.features.curl.index, 0.1235);
  assert.equal(stored.features.thumb.signedNormal, -0.4322);
  // booleans pass through untouched
  assert.equal(stored.features.crossing.isCrossed, false);
  assert.deepEqual(store.all()[0], stored);
});

test("add rejects letters outside the alphabet", () => {
  const store = createStore({ storage: fakeStorage() });
  assert.throws(() => store.add("AA", sample));
  assert.throws(() => store.add("a", sample));
  assert.throws(() => store.add("", sample));
});

test("count, remaining, and counts track additions", () => {
  const store = createStore({ storage: fakeStorage() });
  store.add("A", sample);
  store.add("A", sample);
  store.add("B", sample);

  assert.equal(store.count("A"), 2);
  assert.equal(store.count("B"), 1);
  assert.equal(store.count("C"), 0);
  assert.equal(store.remaining("A"), 28);
  assert.equal(store.counts().A, 2);
  assert.equal(store.counts().B, 1);
});

test("samples persist across stores sharing the same storage", () => {
  const storage = fakeStorage();
  const a = createStore({ storage });
  a.add("A", sample);

  const b = createStore({ storage });
  assert.equal(b.count("A"), 1);
  assert.equal(b.remaining("A"), 29);
});

test("corrupted storage JSON starts empty instead of throwing", () => {
  const store = createStore({ storage: fakeStorage("{not json") });
  assert.equal(store.all().length, 0);
  store.add("C", sample); // still functional after corruption
  assert.equal(store.count("C"), 1);
});

test("exportPayload wraps samples in a versioned envelope", () => {
  const store = createStore({ storage: fakeStorage() });
  store.add("A", sample);

  const payload = store.exportPayload();
  assert.equal(payload.meta.app, "SignSync");
  assert.equal(payload.meta.version, 1);
  assert.equal(payload.meta.targetPerLetter, TARGET_PER_LETTER);
  assert.ok(!Number.isNaN(Date.parse(payload.meta.exported)));
  assert.equal(payload.meta.hand, "canonical right (mirrored from MediaPipe label)");
  assert.deepEqual(payload.samples, store.all());
});

test("clear empties the store and the underlying storage", () => {
  const storage = fakeStorage();
  const store = createStore({ storage });
  store.add("A", sample);
  store.clear();

  assert.equal(store.all().length, 0);
  const fresh = createStore({ storage });
  assert.equal(fresh.all().length, 0);
});

test("quota failure keeps samples in memory and flags persistence", () => {
  const storage = fakeStorage();
  const store = createStore({ storage });
  store.add("A", sample);

  storage.failing = true;
  const stored = store.add("A", sample);
  assert.equal(store.count("A"), 2);
  assert.equal(store.persistFailed, true);
  assert.deepEqual(store.all()[1], stored);

  // and it recovers once storage works again
  storage.failing = false;
  store.add("A", sample);
  assert.equal(store.count("A"), 3);
});
