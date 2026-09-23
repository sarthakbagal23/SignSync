// Symmetric 3×3 eigendecomposition (cyclic Jacobi rotations) and the
// palm-plane PCA fit built on it (design §4.2). Hand-written on purpose —
// it's ~40 lines and a good judging talking point.

import { dot, length } from "./vec3.js";

// One Jacobi rotation in the (p, q) plane, Numerical Recipes §11.1 style:
// pick the smaller-magnitude tan(θ) root so sweeps cannot oscillate, then
// apply the algebraically simplified updates (a_pp ← a_pp − t·a_pq, …).
function rotate(a, v, p, q) {
  const apq = a[p][q];
  if (apq === 0) return;

  const theta = (0.5 * (a[q][q] - a[p][p])) / apq;
  const t =
    (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(1 + t * t);
  const s = t * c;

  a[p][p] -= t * apq;
  a[q][q] += t * apq;
  a[p][q] = 0;
  a[q][p] = 0;

  // Rotate the remaining row/column pair (r is the third index).
  const r = 3 - p - q;
  const arp = a[r][p];
  const arq = a[r][q];
  a[r][p] = a[p][r] = c * arp - s * arq;
  a[r][q] = a[q][r] = s * arp + c * arq;

  // Accumulate V ← VG; column i of V is the eigenvector for a_ii.
  for (let k = 0; k < 3; k++) {
    const vkp = v[k][p];
    const vkq = v[k][q];
    v[k][p] = c * vkp - s * vkq;
    v[k][q] = s * vkp + c * vkq;
  }
}

// Eigendecomposition of a symmetric 3×3 matrix. Returns eigenpairs sorted
// ascending by eigenvalue; eigenvectors are orthonormal.
export function symmetricEig(m) {
  const a = m.map((row) => [...row]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  const scale = Math.max(1, ...a.flat().map(Math.abs));
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) off += Math.abs(a[i][j]);
    if (off <= 1e-14 * scale) break;
    for (let p = 0; p < 2; p++)
      for (let q = p + 1; q < 3; q++) rotate(a, v, p, q);
  }

  const pairs = [0, 1, 2].map((i) => ({
    value: a[i][i],
    vector: [v[0][i], v[1][i], v[2][i]],
  }));
  pairs.sort((x, y) => x.value - y.value);
  return {
    values: pairs.map((p) => p.value),
    vectors: pairs.map((p) => p.vector),
  };
}

// PCA plane fit: the normal is the smallest-eigenvalue eigenvector of the
// covariance of `points`. Sign is left ambiguous here — normalize.js fixes
// it per hand (§4.2 sign rule).
export function fitPlaneNormal(points) {
  const n = points.length;

  const mu = [0, 0, 0];
  for (const p of points) {
    mu[0] += p[0] / n;
    mu[1] += p[1] / n;
    mu[2] += p[2] / n;
  }

  const c = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = [p[0] - mu[0], p[1] - mu[1], p[2] - mu[2]];
    for (let i = 0; i < 3; i++)
      for (let j = i; j < 3; j++) c[i][j] += (d[i] * d[j]) / n;
  }
  c[1][0] = c[0][1];
  c[2][0] = c[0][2];
  c[2][1] = c[1][2];

  return symmetricEig(c).vectors[0];
}
