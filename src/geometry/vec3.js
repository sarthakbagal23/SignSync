// 3-vector primitives for the geometry layer. Points are [x, y, z] arrays.
// MediaPipe world-landmark convention: +x right, +y down, +z toward the
// viewer (out of the palm for a right hand facing the camera).

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize(v) {
  const n = length(v);
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n];
}

// atan2 form rather than acos: exact 0 / π/2 / π for the canonical cases and
// no precision loss near parallel vectors (acos(c) amplifies rounding in c).
export function angleBetween(a, b) {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

// Exponential moving average helpers (§4.2 frame smoothing).
export function ema(prev, next, alpha) {
  return prev + (next - prev) * alpha;
}

export function emaVec(prev, next, alpha) {
  return [
    ema(prev[0], next[0], alpha),
    ema(prev[1], next[1], alpha),
    ema(prev[2], next[2], alpha),
  ];
}
