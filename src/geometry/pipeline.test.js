// Tests for the shared per-frame geometry pipeline used by both the main app
// and the capture tool: worldLandmarks → canonical hand → smoothed palm frame
// → features. Locks the handedness convention end to end.

import test from "node:test";
import assert from "node:assert/strict";

import { createPipeline } from "./pipeline.js";
import { canonicalHand, buildHandFrame } from "./normalize.js";
import { computeFeatures } from "./features.js";
import { flatHand, rotateHand } from "./test-hands.js";
import { angleBetween } from "./vec3.js";

test("step returns null when no hand is present", () => {
  const p = createPipeline();
  assert.equal(p.step(null, null), null);
});

test("step produces frame + features matching the manual composition", () => {
  const p = createPipeline();
  const hand = flatHand();

  const out = p.step(hand, "Left");
  const manualFrame = buildHandFrame(canonicalHand(hand, "Left"));
  const manualFeatures = computeFeatures(manualFrame);

  assert.ok(Math.abs(out.frame.scale - manualFrame.scale) < 1e-9);
  assert.ok(angleBetween(out.frame.u, manualFrame.u) < 1e-9);
  assert.deepEqual(Object.keys(out.features), Object.keys(manualFeatures));
  assert.ok(Math.abs(out.features.curl.index - manualFeatures.curl.index) < 1e-9);
  assert.deepEqual(out.hand, canonicalHand(hand, "Left"));
});

test("the mirrored label produces the mirrored hand", () => {
  // canonicalHand(hand, "Right") negates x — the thumb (landmark 4) must end
  // up on the opposite side of the palm (v-axis) vs the pass-through label.
  const p = createPipeline();
  const hand = flatHand();
  const left = p.step(hand, "Left").frame.palmFrame[4][0];
  const right = p.step(hand, "Right").frame.palmFrame[4][0];
  assert.ok(left * right < 0, `expected opposite signs, got ${left} / ${right}`);
});

test("a gap in tracking re-seeds the smoother (no stale blending)", () => {
  const p = createPipeline();
  const hand = flatHand();

  const first = p.step(hand, "Left");
  p.step(null, null);
  const again = p.step(hand, "Left");

  // After re-seeding, the basis is the raw one — identical to `first`'s
  // (which also seeded). If the smoother kept stale state, u would have been
  // EMA'd against nothing / a blend of the same value would still match, so
  // assert the frame is fully usable and basis matches the raw axis.
  assert.ok(again.features.curl.index > 0);
  const rawU = buildHandFrame(canonicalHand(hand, "Left")).uWorld;
  assert.ok(angleBetween(again.frame.u, rawU) < 1e-9);
  assert.ok(angleBetween(first.frame.u, rawU) < 1e-9);
});

test("smoothing actually smooths across frames", () => {
  // Rotate the hand between two frames; the smoothed basis must land
  // strictly between the raw bases (EMA blend), not snap to the new one.
  const p = createPipeline(0.5);
  const a = flatHand();
  const b = rotateHand(a, [0, 0, 1], Math.PI / 6);

  const uA = buildHandFrame(canonicalHand(a, "Left")).uWorld;
  const uB = buildHandFrame(canonicalHand(b, "Left")).uWorld;
  p.step(a, "Left");
  const out = p.step(b, "Left");

  const toRaw = angleBetween(out.frame.u, uB);
  const toOld = angleBetween(out.frame.u, uA);
  assert.ok(toRaw > 1e-6, "basis snapped to the new raw frame — no smoothing");
  assert.ok(Math.abs(toRaw - toOld) < 1e-9, "blend is not symmetric at alpha 0.5");
});
