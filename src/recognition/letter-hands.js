// Synthetic letter hands for the recognition test matrix — built from the
// geometry test-hand helpers. These are FIXTURES: each builder makes a hand
// that satisfies its letter's constraint set by construction (thumb placed
// exactly where the letter wants it). Real-hand variation comes later from
// the capture tool; these exist so the constraint engine has exact
// end-to-end targets (§8 regression suite seeds).

import {
  flatHand,
  foldFinger,
  setThumbTip,
  FINGER,
} from "../geometry/test-hands.js";
import { computeFeatures } from "../geometry/features.js";
import { buildHandFrame } from "../geometry/normalize.js";

// Fold angles per chain, calibrated to this curl scale (§4.3):
//   extended ≈ 0.05, half-curled ≈ 0.24, fist ≈ 0.54.
const FIST_FOLDS = [1.5, 1.9, 0.8]; // ≈86°/109°/46°
const HALF_FOLDS = [0.7, 0.8, 0.4]; // ≈40°/46°/23°
const D_FOLDS = [1.2, 1.6, 0.7]; // ≈69°/92°/40°

function foldAll(hand, folds) {
  for (const f of [FINGER.index, FINGER.middle, FINGER.ring, FINGER.pinky]) {
    hand = foldFinger(hand, f.MCP, folds);
  }
  return hand;
}

function foldThree(hand, folds) {
  for (const f of [FINGER.middle, FINGER.ring, FINGER.pinky]) {
    hand = foldFinger(hand, f.MCP, folds);
  }
  return hand;
}

// A fist with all four fingers fully folded — shared by A (and tests).
export function fist() {
  return foldAll(flatHand(), FIST_FOLDS);
}

// A: fist, thumb riding alongside the index side (not across the front).
export function handA() {
  return setThumbTip(fist(), [-0.55, -0.7, 0.1]);
}

// B: four fingers extended and together, thumb folded across the palm.
export function handB() {
  const hand = flatHand();
  return setThumbTip(hand, [0.3, -0.7, 0.1]);
}

// C: fingers curved into a C, thumb opposite them, in the palm plane.
export function handC() {
  const hand = foldAll(flatHand(), HALF_FOLDS);
  return setThumbTip(hand, [-0.45, -0.55, 0.1]);
}

// D: index extended; middle/ring/pinky curled; thumb tip meets middle tip.
// The thumb is placed programmatically at the folded middle fingertip, so
// the "contact" constraint holds by construction.
export function handD() {
  const hand = foldThree(flatHand(), D_FOLDS);
  return setThumbTip(hand, [...hand[FINGER.middle.TIP]]);
}

// L: index up; middle/ring/pinky curled; thumb out to the side.
export function handL() {
  const hand = foldThree(flatHand(), FIST_FOLDS);
  return setThumbTip(hand, [-0.8, -0.75, 0.1]);
}

// Feature vector for a canonical right hand (builders already canonical).
export function featuresOf(hand) {
  return computeFeatures(buildHandFrame(hand));
}
