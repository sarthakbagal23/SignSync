import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHandFrame } from "./normalize.js";
import { computeFeatures } from "./features.js";
import {
  flatHand,
  foldFinger,
  splayFinger,
  setThumbTip,
  rotateHand,
  FINGER,
} from "./test-hands.js";

const RAD = Math.PI / 180;

function frameOf(hand) {
  return buildHandFrame(hand);
}

test("flat hand: every finger curl is near zero", () => {
  const f = computeFeatures(frameOf(flatHand()));
  for (const name of ["index", "middle", "ring", "pinky"]) {
    assert.ok(f.curl[name] < 0.05, `${name} curl ${f.curl[name]}`);
  }
});

test("half-folded index reads curl ≈ 0.25; other fingers unaffected", () => {
  const hand = foldFinger(flatHand(), FINGER.index.MCP, [45 * RAD, 45 * RAD, 30 * RAD]);
  const f = computeFeatures(frameOf(hand));
  assert.ok(Math.abs(f.curl.index - 0.25) < 0.03, `curl.index ${f.curl.index}`);
  assert.ok(f.curl.middle < 0.05);
  assert.ok(f.curl.ring < 0.05);
  assert.ok(f.curl.pinky < 0.05);
});

test("tightly folded index reads curl > 0.7 and more fold means more curl", () => {
  const half = computeFeatures(frameOf(foldFinger(flatHand(), FINGER.index.MCP, [45 * RAD, 45 * RAD, 30 * RAD])));
  const tight = computeFeatures(frameOf(foldFinger(flatHand(), FINGER.index.MCP, [135 * RAD, 135 * RAD, 90 * RAD])));
  assert.ok(tight.curl.index > 0.7, `curl.index ${tight.curl.index}`);
  assert.ok(tight.curl.index > half.curl.index);
});

test("flat hand: adjacent-finger spreads are near zero", () => {
  const f = computeFeatures(frameOf(flatHand()));
  assert.ok(f.spread.indexMiddle < 0.05);
  assert.ok(f.spread.middleRing < 0.05);
  assert.ok(f.spread.ringPinky < 0.05);
});

test("splayed index+middle read ≈ 20° between them (V), less when together (U)", () => {
  const vHand = splayFinger(splayFinger(flatHand(), FINGER.index.MCP, -10 * RAD), FINGER.middle.MCP, 10 * RAD);
  const uHand = splayFinger(splayFinger(flatHand(), FINGER.index.MCP, -2.5 * RAD), FINGER.middle.MCP, 2.5 * RAD);
  const v = computeFeatures(frameOf(vHand));
  const u = computeFeatures(frameOf(uHand));
  assert.ok(Math.abs(v.spread.indexMiddle - 20 * RAD) < RAD, `V spread ${v.spread.indexMiddle}`);
  assert.ok(u.spread.indexMiddle < v.spread.indexMiddle / 2);
  // The middle finger is splayed +10° away from the unsplayed ring, so the
  // middle↔ring spread is ~10° by construction.
  assert.ok(Math.abs(v.spread.middleRing - 10 * RAD) < RAD);
});

test("crossed index/middle tips set isCrossed; flat hand does not", () => {
  const flat = computeFeatures(frameOf(flatHand()));
  assert.equal(flat.crossing.isCrossed, false);
  const hand = flatHand();
  hand[FINGER.index.TIP] = [-0.02, -1.9, 0]; // index tip crossed to +v side
  hand[FINGER.middle.TIP] = [-0.38, -1.94, 0]; // middle tip crossed to −v side
  const crossed = computeFeatures(frameOf(hand));
  assert.equal(crossed.crossing.isCrossed, true);
  assert.ok(crossed.crossing.indexLateral > 0);
  assert.ok(crossed.crossing.middleLateral < 0);
});

test("thumb tip on the index tip reads tipDist.index ≈ 0", () => {
  const hand = setThumbTip(flatHand(), flatHand()[FINGER.index.TIP]);
  const f = computeFeatures(frameOf(hand));
  assert.ok(f.thumb.tipDist.index < 0.02, `tipDist.index ${f.thumb.tipDist.index}`);
});

test("thumb tip distances are scale-relative (palm units)", () => {
  const hand = flatHand();
  const frame = frameOf(hand);
  const midTip = hand[FINGER.middle.TIP].slice();
  setThumbTip(hand, [midTip[0] + 0.3, midTip[1], midTip[2]]);
  const f = computeFeatures(frameOf(hand));
  assert.ok(Math.abs(f.thumb.tipDist.middle * frame.scale - 0.3) < 0.01);
});

test("thumb signedNormal tracks out-of-palm position", () => {
  const base = computeFeatures(frameOf(setThumbTip(flatHand(), [-0.3, -0.8, 0.22])));
  const raised = computeFeatures(frameOf(setThumbTip(flatHand(), [-0.3, -0.8, 0.45])));
  const pushed = computeFeatures(frameOf(setThumbTip(flatHand(), [-0.3, -0.8, -0.45])));
  assert.ok(raised.thumb.signedNormal > 0.4, `raised ${raised.thumb.signedNormal}`);
  assert.ok(pushed.thumb.signedNormal < -0.4, `pushed ${pushed.thumb.signedNormal}`);
  assert.ok(raised.thumb.signedNormal > base.thumb.signedNormal);
});

test("thumb lateral reads position across the MCP row", () => {
  const frame = frameOf(flatHand());
  const f0 = computeFeatures(frameOf(setThumbTip(flatHand(), [0, -0.9, 0.22])));
  const fPos = computeFeatures(frameOf(setThumbTip(flatHand(), [0.3, -0.9, 0.22])));
  const fNeg = computeFeatures(frameOf(setThumbTip(flatHand(), [-0.3, -0.9, 0.22])));
  assert.ok(fPos.thumb.lateral > 0.15);
  assert.ok(fNeg.thumb.lateral < -0.15);
  // A 0.6 world-unit sweep across the row, measured in palm units.
  assert.ok(Math.abs((fPos.thumb.lateral - fNeg.thumb.lateral) * frame.scale - 0.6) < 0.05);
});

test("orientation passes the world-frame basis through untouched", () => {
  const frame = frameOf(flatHand());
  const f = computeFeatures(frame);
  assert.deepEqual(f.orientation.pointing, frame.uWorld);
  assert.deepEqual(f.orientation.palmFacing, frame.wWorld);
});

test("shape features are rotation-invariant end to end", () => {
  const base = computeFeatures(frameOf(flatHand()));
  const rotated = computeFeatures(frameOf(rotateHand(flatHand(), [1, 1, 0.5], 0.7)));
  for (const name of ["index", "middle", "ring", "pinky"]) {
    assert.ok(Math.abs(base.curl[name] - rotated.curl[name]) < 0.02);
  }
  assert.ok(Math.abs(base.spread.indexMiddle - rotated.spread.indexMiddle) < 0.02);
  assert.ok(Math.abs(base.thumb.tipDist.index - rotated.thumb.tipDist.index) < 0.02);
  assert.ok(Math.abs(base.thumb.signedNormal - rotated.thumb.signedNormal) < 0.02);
});
