import { test } from "node:test";
import assert from "node:assert/strict";
import {
  add,
  sub,
  scale,
  dot,
  cross,
  length,
  normalize,
  angleBetween,
  ema,
  emaVec,
} from "./vec3.js";

test("add sums componentwise", () => {
  assert.deepEqual(add([1, 2, 3], [10, 20, 30]), [11, 22, 33]);
});

test("sub subtracts componentwise", () => {
  assert.deepEqual(sub([11, 22, 33], [1, 2, 3]), [10, 20, 30]);
});

test("scale multiplies every component", () => {
  assert.deepEqual(scale([1, -2, 3], 2), [2, -4, 6]);
});

test("dot returns sum of products", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  assert.equal(dot([1, 0, 0], [0, 1, 0]), 0);
});

test("cross follows the right-hand rule", () => {
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  assert.deepEqual(cross([0, 1, 0], [1, 0, 0]), [0, 0, -1]);
  assert.deepEqual(cross([3, -3, 1], [4, 9, 2]), [-15, -2, 39]);
});

test("length gives the Euclidean norm", () => {
  assert.equal(length([0, 3, 4]), 5);
  assert.equal(length([0, 0, 0]), 0);
});

test("normalize returns a unit vector in the same direction", () => {
  const v = normalize([0, 3, 4]);
  assert.deepEqual(v, [0, 0.6, 0.8]);
  assert.equal(length(v), 1);
});

test("angleBetween is 0 for parallel, pi/2 for perpendicular, pi for opposite", () => {
  assert.equal(angleBetween([1, 2, 3], [2, 4, 6]), 0);
  assert.equal(angleBetween([2, 0, 0], [0, 5, 0]), Math.PI / 2);
  assert.equal(angleBetween([1, 1, 0], [-2, -2, 0]), Math.PI);
});

test("ema interpolates by alpha", () => {
  assert.equal(ema(0, 10, 1), 10);
  assert.equal(ema(0, 10, 0), 0);
  assert.equal(ema(0, 10, 0.25), 2.5);
});

test("emaVec applies ema componentwise", () => {
  assert.deepEqual(emaVec([0, 10, 20], [10, 10, 10], 0.5), [5, 10, 15]);
});
