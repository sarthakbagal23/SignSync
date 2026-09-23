// Handedness mirroring + wrist/scale normalization + palm-frame construction
// (design §4.1–4.2). Input: a hand as 21 [x, y, z] world landmarks —
// worldLandmarks, NOT image landmarks (§2 gotcha #1).

import {
  cross,
  dot,
  emaVec,
  length,
  normalize as unit,
  scale as mul,
  sub,
} from "./vec3.js";
import { fitPlaneNormal } from "./plane.js";

// The six palm-adjacent landmarks the plane is fit through (§4.2).
export const PALM_POINTS = [0, 1, 5, 9, 13, 17];

// Handedness convention (§4.1 trap #1, written down as instructed):
// MediaPipe assumes a mirrored selfie image. Our raw feed is NOT mirrored
// (CSS scaleX(-1) flips only the preview), so reported labels are inverted:
// a physical LEFT hand reads "Right" from the tracker. Mirror x when the
// label says "Right"; classify every hand with the right-hand constraint set.
export const MIRROR_WHEN_LABEL = "Right";

// Normalize to the canonical right hand. Never mutates the input.
export function canonicalHand(hand, label) {
  if (label !== MIRROR_WHEN_LABEL) return hand.map((p) => [...p]);
  return hand.map((p) => [-p[0], p[1], p[2]]);
}

// buildHandFrame(hand, smoothed?)
//
// Translate to the wrist (origin = landmark 0), scale by ‖L9 − L0‖, rotate
// into the palm frame. Basis convention:
//   u = unit(L9 − L0) exactly — the rigid wrist→middle-knuckle axis (§4.2);
//   w = PCA palm-plane normal, sign-fixed to point out of the palm, then
//       Gram-Schmidt cleaned against u (u is the stable anchor; the z-heavy
//       PCA normal is the noisy channel that gets corrected);
//   v = w × u.
// `smoothed` ({u, w}, orthonormal — FrameSmoother output) replaces the raw
// basis so palm-frame coordinates inherit temporal smoothing (§4.2).
export function buildHandFrame(hand, smoothed = null) {
  const wrist = hand[0];
  const scale = length(sub(hand[9], wrist));

  // Raw world-frame directions, kept for orientation features (§4.4):
  // pointing = u, palm facing = w.
  const uWorld = unit(sub(hand[9], wrist));
  const wPalm = fitPlaneNormal(PALM_POINTS.map((i) => hand[i]));
  // Sign rule (§4.2): make w agree with cross(L5−L0, L17−L0), which points
  // out of the palm for a right hand.
  const outOfPalm = cross(sub(hand[5], wrist), sub(hand[17], wrist));
  const flip = dot(wPalm, outOfPalm) < 0 ? -1 : 1;
  const wWorld = [wPalm[0] * flip, wPalm[1] * flip, wPalm[2] * flip];

  const u = smoothed ? smoothed.u : uWorld;
  const w = smoothed
    ? smoothed.w
    : unit(sub(wWorld, mul(u, dot(wWorld, u))));
  const v = cross(w, u);

  // Similarity transform: rotation into (v, u, w) plus scale — distances map
  // to world distances / scale, angles are preserved exactly.
  const palmFrame = hand.map((p) => {
    const d = sub(p, wrist);
    return [dot(d, v) / scale, dot(d, u) / scale, dot(d, w) / scale];
  });

  // Centroid of the palm points in palm-frame coordinates. Its z is the
  // offset of the fitted plane from the wrist — features.js subtracts it so
  // the thumb's signedNormal is measured relative to the palm plane (§4.3).
  const palmCentroid = [0, 0, 0];
  for (const i of PALM_POINTS) {
    palmCentroid[0] += palmFrame[i][0] / PALM_POINTS.length;
    palmCentroid[1] += palmFrame[i][1] / PALM_POINTS.length;
    palmCentroid[2] += palmFrame[i][2] / PALM_POINTS.length;
  }

  return { scale, uWorld, wWorld, u, v, w, palmFrame, palmCentroid };
}

// Temporal smoothing of the basis (§4.2): EMA both vectors, then
// re-orthonormalize with Gram-Schmidt — u anchors, w is cleaned against it
// (same convention as buildHandFrame).
export class FrameSmoother {
  constructor(alpha) {
    this.alpha = alpha;
    this.seeded = false;
    this.u = null;
    this.w = null;
  }

  reset() {
    this.seeded = false;
    this.u = null;
    this.w = null;
  }

  smooth(uRaw, wRaw) {
    if (!this.seeded) {
      this.u = unit(uRaw);
      this.w = unit(wRaw);
      this.seeded = true;
    } else {
      this.u = unit(emaVec(this.u, uRaw, this.alpha));
      const blended = emaVec(this.w, wRaw, this.alpha);
      this.w = unit(sub(blended, mul(this.u, dot(blended, this.u))));
    }
    return { u: this.u, v: cross(this.w, this.u), w: this.w };
  }
}
