// Tests for the constraint primitive (design §5.1): trapezoidal satisfaction
// and feature-path resolution.

import test from "node:test";
import assert from "node:assert/strict";

import { satisfy, resolveFeature, validateDef } from "./constraints.js";

test("satisfy is 1 inside the target band", () => {
  assert.equal(satisfy(0.5, 0, 1, 0.2), 1);
  assert.equal(satisfy(0, 0, 1, 0.2), 1);
  assert.equal(satisfy(1, 0, 1, 0.2), 1);
});

test("satisfy decays linearly across the tolerance zone and clamps at 0", () => {
  // Not assert.equal: 1.05 − 1 is 0.04999…93 in binary, so s lands a
  // float's-width off exactly 0.5. Tolerance-form assertions for decay.
  assert.ok(Math.abs(satisfy(-0.1, 0, 1, 0.2) - 0.5) < 1e-9);
  assert.ok(Math.abs(satisfy(1.1, 0, 1, 0.2) - 0.5) < 1e-9);
  assert.ok(Math.abs(satisfy(1.05, 0, 1, 0.1) - 0.5) < 1e-9);
  assert.equal(satisfy(1.3, 0, 1, 0.2), 0);
  assert.equal(satisfy(-0.5, 0, 1, 0.2), 0);
});

test("satisfy handles a point band, and tol 0 means hard binary membership", () => {
  assert.equal(satisfy(0.5, 0.5, 0.5, 0.1), 1);
  assert.equal(satisfy(0.5, 0.5, 0.5, 0), 1);
  assert.equal(satisfy(0.6, 0.5, 0.5, 0), 0);
  assert.equal(satisfy(0.4, 0.5, 0.5, 0), 0);
});

test("resolveFeature walks dotted paths into the feature vector", () => {
  const features = {
    curl: { index: 0.1 },
    thumb: { tipDist: { pinky: 0.7 } },
    crossing: { isCrossed: true },
    orientation: { pointing: [0.1, -0.9, 0.2] },
  };
  assert.equal(resolveFeature(features, "curl.index"), 0.1);
  assert.equal(resolveFeature(features, "thumb.tipDist.pinky"), 0.7);
  assert.equal(resolveFeature(features, "crossing.isCrossed"), true);
  assert.deepEqual(resolveFeature(features, "orientation.pointing"), [0.1, -0.9, 0.2]);
});

test("resolveFeature supports array indexing: orientation.pointing[1]", () => {
  const features = { orientation: { pointing: [0.1, -0.9, 0.2] } };
  assert.equal(resolveFeature(features, "orientation.pointing[1]"), -0.9);
});

test("resolveFeature throws on unknown paths — constraint typos fail loudly", () => {
  const features = { curl: { index: 0.1 }, orientation: { pointing: [1, 2, 3] } };
  assert.throws(() => resolveFeature(features, "curl.nope"));
  assert.throws(() => resolveFeature(features, "nope.index"));
  assert.throws(() => resolveFeature(features, "curl.index[0]"), /non-array/);
});

const good = {
  letter: "A",
  constraints: [
    { id: "a-1", feature: "curl.index", lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true },
    { id: "a-2", feature: "thumb.signedNormal", lo: -0.15, hi: 0.15, tol: 0.15, weight: 2 },
  ],
};

test("validateDef accepts a well-formed definition", () => {
  validateDef(good);
});

test("validateDef rejects malformed definitions", () => {
  assert.throws(() => validateDef({ letter: "A", constraints: [] }), /constraint/i);
  assert.throws(() => validateDef({ constraints: good.constraints }), /letter/i);
  // hi < lo, negative tol, negative weight, bad feature path type
  const badBand = { letter: "A", constraints: [{ ...good.constraints[0], hi: 0.1 }] };
  assert.throws(() => validateDef(badBand), /hi/);
  const badTol = { letter: "A", constraints: [{ ...good.constraints[0], tol: -1 }] };
  assert.throws(() => validateDef(badTol), /tol/);
  const badWeight = { letter: "A", constraints: [{ ...good.constraints[0], weight: -1 }] };
  assert.throws(() => validateDef(badWeight), /weight/);
  const badFeature = { letter: "A", constraints: [{ ...good.constraints[0], feature: 5 }] };
  assert.throws(() => validateDef(badFeature), /feature/);
  assert.throws(() => validateDef({ letter: "AA", constraints: good.constraints }), /letter/i);
});
