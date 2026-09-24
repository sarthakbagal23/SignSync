// Tests for the capture sampler: decides WHEN to auto-capture — the hand is
// present, held reasonably still (consecutive-frame feature drift below a
// threshold), and the inter-capture interval has elapsed.

import test from "node:test";
import assert from "node:assert/strict";

import { createSampler, scalarize, meanAbsDiff, maxAbsDiff } from "./sampler.js";
import { computeFeatures } from "../geometry/features.js";
import { buildHandFrame } from "../geometry/normalize.js";
import { flatHand, rotateHand, foldFinger, FINGER } from "../geometry/test-hands.js";

function featuresOf(hand) {
  return computeFeatures(buildHandFrame(hand));
}

test("scalarize flattens the feature vector to a fixed-length number array", () => {
  const s = scalarize(featuresOf(flatHand()));
  // 4 curls + 3 spreads + 2 crossing laterals + 4+4+4 thumb distances
  // + signedNormal + lateral + 3+3 orientation components = 29
  assert.equal(s.length, 29);
  assert.ok(s.every((x) => Number.isFinite(x)));
});

test("scalarize distinguishes hands that differ in one feature", () => {
  const a = scalarize(featuresOf(flatHand()));
  const b = scalarize(featuresOf(rotateHand(flatHand(), [0, 0, 1], 0.2)));
  assert.ok(a.some((x, i) => Math.abs(x - b[i]) > 1e-9));
});

test("meanAbsDiff averages absolute differences", () => {
  assert.equal(meanAbsDiff([1, 2, 3], [2, 4, 3]), (1 + 2 + 0) / 3);
  assert.equal(meanAbsDiff([], []), 0);
});

test("no hand means never capture, and the previous frame is forgotten", () => {
  const s = createSampler({ now: () => 0 });
  assert.deepEqual(s.tick(null), { capture: false, stable: false });

  const hand = flatHand();
  const f = featuresOf(hand);
  assert.equal(s.tick(f).capture, false); // first sight: nothing to compare
  s.tick(null);
  // re-arrival must need a fresh pair of frames before it can be "stable"
  assert.equal(s.tick(f).stable, false);
  assert.equal(s.tick(f).stable, true);
});

test("a still hand captures on the first stable frame, then rate-limits", () => {
  let t = 0;
  const s = createSampler({ intervalMs: 400, stableThreshold: 0.01, now: () => t });
  const f = featuresOf(flatHand());

  s.tick(f); // t=0: first sight
  t = 100;
  const first = s.tick(f); // stable → captures immediately (lastCapture = -∞)
  assert.deepEqual(first, { capture: true, stable: true });

  t = 200;
  assert.equal(s.tick(f).capture, false); // 100ms since last — too soon
  t = 400;
  assert.equal(s.tick(f).capture, false); // 300ms — still too soon
  t = 550;
  assert.deepEqual(s.tick(f), { capture: true, stable: true }); // 450ms ≥ 400ms
});

test("maxAbsDiff reports the largest component difference", () => {
  assert.equal(maxAbsDiff([1, 5, 2], [1, 5.5, 2]), 0.5);
  assert.equal(maxAbsDiff([], []), 0);
});

test("a shape transition (closing finger) is never stable, so never captured", () => {
  let t = 0;
  const s = createSampler({ intervalMs: 400, now: () => t });

  let hand = flatHand();
  for (let i = 0; i < 12; i++) {
    t += 50;
    // ~23°/frame at MCP and PIP: a fast but realistic transition speed.
    hand = foldFinger(hand, FINGER.index.MCP, [0.2, 0.2, 0.1]);
    const out = s.tick(featuresOf(hand));
    assert.equal(out.stable, false, `frame ${i} should be unstable`);
    assert.equal(out.capture, false, `frame ${i} should not capture`);
  }
});

test("an orientation change (yawing hand) is never stable either", () => {
  let t = 0;
  const s = createSampler({ intervalMs: 400, now: () => t });

  let hand = flatHand();
  for (let i = 0; i < 12; i++) {
    t += 50;
    hand = rotateHand(hand, [0, 1, 0], 0.15); // keep yawing every frame
    const out = s.tick(featuresOf(hand));
    assert.equal(out.stable, false, `frame ${i} should be unstable`);
    assert.equal(out.capture, false, `frame ${i} should not capture`);
  }
});

test("tiny jitter (below threshold) still counts as still", () => {
  let t = 0;
  const s = createSampler({ intervalMs: 400, now: () => t });
  const base = featuresOf(flatHand());

  const jittered = () => {
    const f = featuresOf(flatHand());
    f.curl.index += 0.001; // well below the 0.01 threshold
    return f;
  };

  s.tick(jittered());
  t = 100;
  assert.equal(s.tick(jittered()).stable, true);
});
