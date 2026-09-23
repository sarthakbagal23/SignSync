import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalHand,
  buildHandFrame,
  FrameSmoother,
  MIRROR_WHEN_LABEL,
} from "./normalize.js";
import { flatHand, rotateHand, rotateAboutAxis, scaleHand, FINGER, PALM_POINTS } from "./test-hands.js";
import { dot, length, sub, angleBetween, normalize as unit } from "./vec3.js";

const TOL = 1e-6;
const AXIS = [1, 1, 0.5];

test("documented convention: mirror when MediaPipe label says Right", () => {
  // MediaPipe assumes a mirrored selfie image; our raw feed is not mirrored
  // (CSS only flips the preview), so its labels are inverted. See normalize.js.
  assert.equal(MIRROR_WHEN_LABEL, "Right");
});

test("canonicalHand negates x only for the mirror label, and never mutates input", () => {
  const hand = flatHand();
  const original = hand[8].slice();
  const rightHand = canonicalHand(hand, "Left");
  const leftHand = canonicalHand(hand, "Right");
  assert.deepEqual(hand[8], original); // input untouched
  assert.deepEqual(rightHand[8], original); // "Left" label: pass through
  assert.equal(leftHand[8][0], -original[0]); // "Right" label: mirror x
  assert.equal(leftHand[8][1], original[1]);
});

test("buildHandFrame reports scale = |L9 − L0|", () => {
  const frame = buildHandFrame(flatHand());
  assert.ok(Math.abs(frame.scale - length(sub(flatHand()[9], flatHand()[0]))) < TOL);
});

test("uWorld is the normalized wrist→middle-MCP direction", () => {
  const hand = flatHand();
  const frame = buildHandFrame(hand);
  const expected = unit(sub(hand[9], hand[0]));
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(frame.uWorld[k] - expected[k]) < TOL);
  }
});

test("wWorld points out of the palm (+z for the canonical flat hand)", () => {
  const frame = buildHandFrame(flatHand());
  assert.ok(frame.wWorld[2] > 0.98);
  // The sign rule: w agrees with cross(L5−L0, L17−L0).
  const hand = flatHand();
  const c = [
    (hand[5][1] - hand[0][1]) * (hand[17][2] - hand[0][2]) - (hand[5][2] - hand[0][2]) * (hand[17][1] - hand[0][1]),
    (hand[5][2] - hand[0][2]) * (hand[17][0] - hand[0][0]) - (hand[5][0] - hand[0][0]) * (hand[17][2] - hand[0][2]),
    (hand[5][0] - hand[0][0]) * (hand[17][1] - hand[0][1]) - (hand[5][1] - hand[0][1]) * (hand[17][0] - hand[0][0]),
  ];
  assert.ok(dot(frame.wWorld, c) > 0);
});

test("basis is orthonormal and v = cross(w, u)", () => {
  const frame = buildHandFrame(flatHand());
  assert.ok(Math.abs(length(frame.u) - 1) < TOL);
  assert.ok(Math.abs(length(frame.v) - 1) < TOL);
  assert.ok(Math.abs(length(frame.w) - 1) < TOL);
  assert.ok(Math.abs(dot(frame.u, frame.v)) < TOL);
  assert.ok(Math.abs(dot(frame.u, frame.w)) < TOL);
  assert.ok(Math.abs(dot(frame.v, frame.w)) < TOL);
  const cw = [
    frame.w[1] * frame.u[2] - frame.w[2] * frame.u[1],
    frame.w[2] * frame.u[0] - frame.w[0] * frame.u[2],
    frame.w[0] * frame.u[1] - frame.w[1] * frame.u[0],
  ];
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(frame.v[k] - cw[k]) < TOL);
});

test("palm-frame landmarks: wrist at origin, middle MCP one unit up, thumb/index on −v side", () => {
  const frame = buildHandFrame(flatHand());
  assert.deepEqual(frame.palmFrame[0].map((x) => Math.abs(x) < TOL ? 0 : x), [0, 0, 0]);
  assert.ok(Math.abs(frame.palmFrame[9][0]) < TOL);
  assert.ok(Math.abs(frame.palmFrame[9][1] - 1) < TOL);
  assert.ok(Math.abs(frame.palmFrame[9][2]) < TOL);
  assert.ok(frame.palmFrame[5][0] < 0); // index MCP on the −v (thumb) side
  assert.ok(frame.palmFrame[4][0] < 0); // thumb tip on the −v side
  assert.ok(frame.palmFrame[1][2] > 0); // thumb CMC sits out of the palm plane
});

test("palm frame is invariant to world rotation; uWorld/wWorld rotate with the hand", () => {
  const base = buildHandFrame(flatHand());
  const rotated = buildHandFrame(rotateHand(flatHand(), AXIS, 0.7));
  for (let i = 0; i < 21; i++) {
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(base.palmFrame[i][k] - rotated.palmFrame[i][k]) < 1e-4);
    }
  }
  const uRot = rotateAboutAxis(base.uWorld, AXIS, 0.7);
  const wRot = rotateAboutAxis(base.wWorld, AXIS, 0.7);
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(rotated.uWorld[k] - uRot[k]) < 1e-4);
    assert.ok(Math.abs(rotated.wWorld[k] - wRot[k]) < 1e-4);
  }
});

test("180° turn about y flips wWorld to face −z but keeps the palm frame", () => {
  const base = buildHandFrame(flatHand());
  const turned = buildHandFrame(rotateHand(flatHand(), [0, 1, 0], Math.PI));
  assert.ok(turned.wWorld[2] < -0.98);
  for (let i = 0; i < 21; i++) {
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(base.palmFrame[i][k] - turned.palmFrame[i][k]) < 1e-4);
    }
  }
});

test("doubling hand size doubles scale and leaves the palm frame unchanged", () => {
  const base = buildHandFrame(flatHand());
  const big = buildHandFrame(scaleHand(flatHand(), 2));
  assert.ok(Math.abs(big.scale / base.scale - 2) < 1e-6);
  for (let i = 0; i < 21; i++) {
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(base.palmFrame[i][k] - big.palmFrame[i][k]) < 1e-4);
    }
  }
});

test("palmCentroid sits near the wrist's height in the palm frame", () => {
  // The fitted plane passes through the palm centroid, but the palm frame
  // measures z from the WRIST, so the centroid's z equals the wrist's
  // off-plane residual (the thumb CMC pulls the fit palm-side). Exactly 0
  // only when the six palm points are coplanar.
  const frame = buildHandFrame(flatHand());
  assert.ok(Math.abs(frame.palmCentroid[2]) < 0.02);
});

test("FrameSmoother seeds with the first frame", () => {
  const s = new FrameSmoother(0.5);
  const out = s.smooth([0, -1, 0], [0, 0, 1]);
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(out.u[k] - [0, -1, 0][k]) < 1e-9);
    assert.ok(Math.abs(out.w[k] - [0, 0, 1][k]) < 1e-9);
  }
});

test("FrameSmoother returns an orthonormal basis halfway between frames", () => {
  const s = new FrameSmoother(0.5);
  s.smooth([0, -1, 0], [0, 0, 1]);
  const out = s.smooth([1, 0, 0], [0, 0, 1]);
  assert.ok(Math.abs(angleBetween(out.u, [0, -1, 0]) - Math.PI / 4) < 0.01);
  assert.ok(Math.abs(length(out.u) - 1) < 1e-9);
  assert.ok(Math.abs(length(out.w) - 1) < 1e-9);
  assert.ok(Math.abs(dot(out.u, out.w)) < 1e-9);
});

test("FrameSmoother Gram-Schmidt rejects the w component along u", () => {
  const s = new FrameSmoother(0.5);
  s.smooth([0, -1, 0], [0, 0, 1]);
  const out = s.smooth([0, -1, 0], [0, 0.6, 0.8]); // tilted toward u
  assert.ok(Math.abs(dot(out.u, out.w)) < 1e-9);
  assert.ok(out.w[2] > 0.9);
});

test("FrameSmoother converges to a held frame", () => {
  const s = new FrameSmoother(0.5);
  s.smooth([0, -1, 0], [0, 0, 1]);
  for (let i = 0; i < 30; i++) s.smooth([1, 0, 0], [0, 0, 1]);
  const out = s.smooth([1, 0, 0], [0, 0, 1]);
  assert.ok(angleBetween(out.u, [1, 0, 0]) < 0.01);
});
