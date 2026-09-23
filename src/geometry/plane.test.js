import { test } from "node:test";
import assert from "node:assert/strict";
import { symmetricEig, fitPlaneNormal } from "./plane.js";
import { dot, length } from "./vec3.js";

const EPS = 1e-6;

function applyMatrix(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

test("symmetricEig returns eigenpairs sorted ascending", () => {
  const m = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 5],
  ];
  const { values, vectors } = symmetricEig(m);
  assert.deepEqual(values, [-1, 1, 5]);
});

test("symmetricEig eigenpairs satisfy A·v = λ·v", () => {
  const m = [
    [4, 1, 2],
    [1, 3, 0],
    [2, 0, 1],
  ];
  const { values, vectors } = symmetricEig(m);
  for (let i = 0; i < 3; i++) {
    const Av = applyMatrix(m, vectors[i]);
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(Av[k] - values[i] * vectors[i][k]) < EPS);
    }
  }
});

test("symmetricEig eigenvectors are orthonormal", () => {
  const m = [
    [4, 1, 2],
    [1, 3, 0],
    [2, 0, 1],
  ];
  const { vectors } = symmetricEig(m);
  for (const v of vectors) {
    assert.ok(Math.abs(length(v) - 1) < EPS);
  }
  assert.ok(Math.abs(dot(vectors[0], vectors[1])) < EPS);
  assert.ok(Math.abs(dot(vectors[0], vectors[2])) < EPS);
  assert.ok(Math.abs(dot(vectors[1], vectors[2])) < EPS);
});

test("symmetricEig on a diagonal matrix returns the axis eigenvectors", () => {
  const { values, vectors } = symmetricEig([
    [3, 0, 0],
    [0, 1, 0],
    [0, 0, 2],
  ]);
  assert.deepEqual(values, [1, 2, 3]);
  assert.deepEqual(vectors[0].map(Math.round), [0, 1, 0]);
  assert.deepEqual(vectors[1].map(Math.round), [0, 0, 1]);
  assert.deepEqual(vectors[2].map(Math.round), [1, 0, 0]);
});

test("fitPlaneNormal finds the normal of the x-y plane", () => {
  const pts = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [2, 3, 0],
    [-1, 0.5, 0],
    [0.3, -2, 0],
  ];
  const n = fitPlaneNormal(pts);
  assert.ok(Math.abs(Math.abs(dot(n, [0, 0, 1])) - 1) < 1e-6);
});

test("fitPlaneNormal finds a tilted plane's normal", () => {
  // Plane x = z: x − z = 0, so the normal is along (1, 0, −1)/√2 (the
  // direction (1, 0, 1) lies IN this plane). Sampled at six points.
  const pts = [
    [0, 0, 0],
    [1, 1, 1],
    [2, -1, 2],
    [1, 3, 1],
    [-1, 2, -1],
    [3, 0, 3],
  ];
  const n = fitPlaneNormal(pts);
  const expected = [1 / Math.SQRT2, 0, -1 / Math.SQRT2];
  assert.ok(Math.abs(Math.abs(dot(n, expected)) - 1) < 1e-6);
});

test("fitPlaneNormal ignores slight off-plane noise in the PCA sense", () => {
  // Palm-like: big spread in x, moderate in y, tiny in z → normal ≈ z.
  const pts = [
    [0, 0, 0.02],
    [0.9, -0.1, -0.01],
    [0.3, -1, 0.005],
    [-0.3, -1.02, -0.02],
    [-0.9, -0.15, 0.01],
    [0.15, -0.5, 0],
  ];
  const n = fitPlaneNormal(pts);
  assert.ok(dot(n, [0, 0, 1]) > 0.98);
});

test("fitPlaneNormal returns a unit vector", () => {
  const pts = [
    [0.1, -0.2, 0.05],
    [0.8, -1.1, 0.02],
    [0.2, -0.9, -0.03],
    [-0.4, -1.0, 0.04],
    [-0.8, -0.3, -0.02],
    [0.05, -0.55, 0.01],
  ];
  assert.ok(Math.abs(length(fitPlaneNormal(pts)) - 1) < 1e-9);
});
