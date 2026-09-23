// Synthetic hands for the geometry unit tests — test-only, never imported by the app.
//
// Frame convention (self-consistent, MediaPipe-style):
//   +x right, +y DOWN (image convention), +z OUT of the palm.
// The canonical hand is a RIGHT hand, palm facing +z, fingers extended along
// −y, thumb on the −x side — how a right hand looks to a viewer it faces.

export const WRIST = 0;
export const THUMB = { CMC: 1, MCP: 2, IP: 3, TIP: 4 };
export const FINGER = {
  index: { MCP: 5, PIP: 6, DIP: 7, TIP: 8 },
  middle: { MCP: 9, PIP: 10, DIP: 11, TIP: 12 },
  ring: { MCP: 13, PIP: 14, DIP: 15, TIP: 16 },
  pinky: { MCP: 17, PIP: 18, DIP: 19, TIP: 20 },
};
export const PALM_POINTS = [0, 1, 5, 9, 13, 17];

const BASE_HAND = [
  [0, 0, 0], // 0 wrist
  [-0.28, -0.3, 0.06], // 1 thumb CMC
  [-0.42, -0.55, 0.12], // 2 thumb MCP
  [-0.52, -0.72, 0.18], // 3 thumb IP
  [-0.58, -0.88, 0.22], // 4 thumb TIP
  [-0.3, -1.0, 0], // 5 index MCP
  [-0.3, -1.4, 0], // 6 index PIP
  [-0.3, -1.68, 0], // 7 index DIP
  [-0.3, -1.9, 0], // 8 index TIP
  [-0.1, -1.02, 0], // 9 middle MCP
  [-0.1, -1.44, 0], // 10 middle PIP
  [-0.1, -1.72, 0], // 11 middle DIP
  [-0.1, -1.94, 0], // 12 middle TIP
  [0.1, -1.0, 0], // 13 ring MCP
  [0.1, -1.38, 0], // 14 ring PIP
  [0.1, -1.64, 0], // 15 ring DIP
  [0.1, -1.84, 0], // 16 ring TIP
  [0.3, -0.94, 0], // 17 pinky MCP
  [0.3, -1.26, 0], // 18 pinky PIP
  [0.3, -1.47, 0], // 19 pinky DIP
  [0.3, -1.65, 0], // 20 pinky TIP
];

export function flatHand() {
  return BASE_HAND.map((p) => [...p]);
}

function unit(v) {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

// Rodrigues' rotation of point p about `axis` through `origin` by `angle`.
export function rotateAboutAxis(p, axis, angle, origin = [0, 0, 0]) {
  const k = unit(axis);
  const x = p[0] - origin[0];
  const y = p[1] - origin[1];
  const z = p[2] - origin[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = k[0] * x + k[1] * y + k[2] * z;
  const cr = [k[1] * z - k[2] * y, k[2] * x - k[0] * z, k[0] * y - k[1] * x];
  return [
    x * c + cr[0] * s + k[0] * d * (1 - c) + origin[0],
    y * c + cr[1] * s + k[1] * d * (1 - c) + origin[1],
    z * c + cr[2] * s + k[2] * d * (1 - c) + origin[2],
  ];
}

export function rotateHand(hand, axis, angle) {
  return hand.map((p) => rotateAboutAxis(p, axis, angle));
}

export function scaleHand(hand, s) {
  return hand.map((p) => [p[0] * s, p[1] * s, p[2] * s]);
}

// Fold one finger chain (given its MCP index) by [mcpFold, pipFold, dipFold]
// radians. Positive folds curl the finger toward the palm (+z): a point above
// the joint (−y) moves toward +z under a negative rotation about +x.
export function foldFinger(hand, mcp, [fMcp, fPip, fDip]) {
  const chain = [mcp, mcp + 1, mcp + 2, mcp + 3];
  const folds = [
    [chain[0], fMcp],
    [chain[1], fPip],
    [chain[2], fDip],
  ];
  for (const [joint, fold] of folds) {
    for (let i = joint + 1; i <= chain[3]; i++) {
      hand[i] = rotateAboutAxis(hand[i], [1, 0, 0], -fold, hand[joint]);
    }
  }
  return hand;
}

// Rotate one finger chain (given its MCP index) within the palm plane about
// its MCP by `angle` radians. Positive angle splays the tip toward +x.
export function splayFinger(hand, mcp, angle) {
  for (let i = mcp + 1; i <= mcp + 3; i++) {
    hand[i] = rotateAboutAxis(hand[i], [0, 0, 1], angle, hand[mcp]);
  }
  return hand;
}

export function setThumbTip(hand, p) {
  hand[4] = [...p];
  return hand;
}
