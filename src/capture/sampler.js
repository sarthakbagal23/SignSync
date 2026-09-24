// Capture sampler (design §8): decides WHEN to auto-capture. A sample is
// taken only when (1) a hand has been tracked for at least two consecutive
// frames, (2) the full feature vector has drifted less than `stableThreshold`
// between those frames — i.e. the handshape is being held, not transitioning
// — and (3) at least `intervalMs` has passed since the last capture.

export function scalarize(features) {
  const f = features;
  return [
    f.curl.index,
    f.curl.middle,
    f.curl.ring,
    f.curl.pinky,
    f.spread.indexMiddle,
    f.spread.middleRing,
    f.spread.ringPinky,
    f.crossing.indexLateral,
    f.crossing.middleLateral,
    f.thumb.tipDist.index,
    f.thumb.tipDist.middle,
    f.thumb.tipDist.ring,
    f.thumb.tipDist.pinky,
    f.thumb.pipDist.index,
    f.thumb.pipDist.middle,
    f.thumb.pipDist.ring,
    f.thumb.pipDist.pinky,
    f.thumb.mcpDist.index,
    f.thumb.mcpDist.middle,
    f.thumb.mcpDist.ring,
    f.thumb.mcpDist.pinky,
    f.thumb.signedNormal,
    f.thumb.lateral,
    f.orientation.pointing[0],
    f.orientation.pointing[1],
    f.orientation.pointing[2],
    f.orientation.palmFacing[0],
    f.orientation.palmFacing[1],
    f.orientation.palmFacing[2],
  ];
}

export function meanAbsDiff(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

// Largest single-component difference. The mean alone DILUTES motion that
// lives in one channel (a yawing hand only moves palmFacing; a closing
// finger only moves its own curl) — 29 scalars would hide a transition
// under a mean threshold. Max catches any single channel moving.
export function maxAbsDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}

export function createSampler({
  intervalMs = 400,
  stableThreshold = 0.01,
  maxDrift = 0.05,
  now = () => performance.now(),
} = {}) {
  let lastCapture = -Infinity;
  let prev = null;

  return {
    // features: the current frame's feature vector, or null if no hand.
    // Returns { capture, stable }.
    tick(features) {
      if (!features) {
        prev = null; // hand lost: require a fresh pair of frames on return
        return { capture: false, stable: false };
      }

      const s = scalarize(features);
      // Dual stability gate: mean catches broad low-level jitter, max
      // catches motion concentrated in one feature (the transition case).
      const stable =
        prev !== null &&
        meanAbsDiff(s, prev) < stableThreshold &&
        maxAbsDiff(s, prev) < maxDrift;
      prev = s;

      if (stable && now() - lastCapture >= intervalMs) {
        lastCapture = now();
        return { capture: true, stable: true };
      }
      return { capture: false, stable };
    },
  };
}
