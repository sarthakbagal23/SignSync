// Shared per-frame geometry pipeline (design §4): worldLandmarks → canonical
// right hand → smoothed palm frame → features. Used by both the main app and
// the capture tool, so there is exactly one place where the handedness and
// smoothing conventions live.

import { canonicalHand, buildHandFrame, FrameSmoother } from "./normalize.js";
import { computeFeatures } from "./features.js";

export function createPipeline(alpha = 0.4) {
  const smoother = new FrameSmoother(alpha);

  return {
    // world: 21 [x, y, z] world landmarks (metric, not image space).
    // label: MediaPipe handedness label ("Left"/"Right") or null.
    // Returns { frame, features, hand } or null when no hand is present.
    step(world, label) {
      if (!world) {
        smoother.reset(); // tracking gap → re-seed, no stale blending
        return null;
      }

      const hand = canonicalHand(world, label);
      const raw = buildHandFrame(hand);
      // Smooth the RAW ORTHONORMAL basis (u, w) — not wWorld. On the seed
      // frame the smoother passes its input through, and wWorld is not yet
      // orthogonal to u; passing raw.w keeps even the first frame's basis
      // orthonormal (bit-identical to the unsmoothed frame).
      const basis = smoother.smooth(raw.u, raw.w);
      const frame = buildHandFrame(hand, basis);

      return { frame, features: computeFeatures(frame), hand };
    },
  };
}
