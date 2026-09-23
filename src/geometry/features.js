// Shape and orientation features (design §4.3–4.4). Shape features are
// computed in the palm frame (rotation-invariant, scale-free); orientation
// passes the world-frame basis through untouched — K/P, G/Q live there.

import { angleBetween, length, sub } from "./vec3.js";

const FINGERS = [
  { name: "index", mcp: 5, pip: 6, dip: 7, tip: 8, prev: 0 },
  { name: "middle", mcp: 9, pip: 10, dip: 11, tip: 12, prev: 0 },
  { name: "ring", mcp: 13, pip: 14, dip: 15, tip: 16, prev: 0 },
  { name: "pinky", mcp: 17, pip: 18, dip: 19, tip: 20, prev: 0 },
];

const TWO_PI = 2 * Math.PI;

// Interior angle at joint j between its two neighbours, in radians.
function interiorAngle(points, a, j, b) {
  return angleBetween(sub(points[a], points[j]), sub(points[b], points[j]));
}

// §4.3: ~0 extended, ~1 fully curled. Angles (not tip distances) because
// distance ratios degrade when the finger points along the camera axis.
function curl(points, f) {
  const mcp = interiorAngle(points, f.prev, f.mcp, f.pip);
  const pip = interiorAngle(points, f.mcp, f.pip, f.dip);
  return 1 - (mcp + pip) / TWO_PI;
}

// MCP→TIP direction projected into the palm plane (drop the w component) —
// unit vector in (v, u) space.
function planarDirection(points, f) {
  const d = sub(points[f.tip], points[f.mcp]);
  const len = Math.hypot(d[0], d[1]);
  return len === 0 ? [0, 0] : [d[0] / len, d[1] / len];
}

// Angle between adjacent fingers' projected directions — separates U from V.
function spread(points, f, g) {
  const a = planarDirection(points, f);
  const b = planarDirection(points, g);
  return angleBetween([a[0], a[1], 0], [b[0], b[1], 0]);
}

export function computeFeatures(frame) {
  const p = frame.palmFrame;

  const curls = {};
  for (const f of FINGERS) curls[f.name] = curl(p, f);

  const [index, middle, ring, pinky] = FINGERS;
  const spreads = {
    indexMiddle: spread(p, index, middle),
    middleRing: spread(p, middle, ring),
    ringPinky: spread(p, ring, pinky),
  };

  // Crossing (R): lateral (v-axis) tip position relative to each finger's
  // own MCP. A normal two-finger extension keeps index on −v and middle on
  // +v; when crossed, the tips swap sides. A sign flip is a clean, binary,
  // explainable test (§4.3).
  const indexLateral = p[index.tip][0] - p[index.mcp][0];
  const middleLateral = p[middle.tip][0] - p[middle.mcp][0];
  const crossing = {
    indexLateral,
    middleLateral,
    isCrossed: indexLateral > 0 && middleLateral < 0,
  };

  // Thumb feature family (§4.3) — the closed-fist group depends on it.
  const thumbTip = p[4];
  const thumb = {
    tipDist: {},
    pipDist: {},
    mcpDist: {},
    // "Is the thumb beside the fist, or in front of it?" — measured relative
    // to the fitted palm plane (the centroid's z is the plane's offset).
    signedNormal: thumbTip[2] - frame.palmCentroid[2],
  };
  let mcpRow = 0;
  for (const f of FINGERS) {
    thumb.tipDist[f.name] = length(sub(thumbTip, p[f.tip]));
    thumb.pipDist[f.name] = length(sub(thumbTip, p[f.pip]));
    thumb.mcpDist[f.name] = length(sub(thumbTip, p[f.mcp]));
    mcpRow += p[f.mcp][0] / 4;
  }
  // How far across the fist has the thumb traveled? (M versus N.)
  thumb.lateral = thumbTip[0] - mcpRow;

  // Orientation features must NOT be rotation-normalized (§4.4) — pass the
  // world-frame vectors through unchanged.
  const orientation = {
    pointing: frame.uWorld,
    palmFacing: frame.wWorld,
  };

  return { curl: curls, spread: spreads, crossing, thumb, orientation };
}
