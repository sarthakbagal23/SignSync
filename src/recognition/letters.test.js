// The Phase 3 end-to-end matrix (design §12): five visually distinct
// letters — A, B, C, D, L — must validate as definitions, resolve every
// feature path against a real feature vector, and classify their synthetic
// hands correctly, unambiguously, above the acceptance gate.

import test from "node:test";
import assert from "node:assert/strict";

import { ALPHABET } from "./letters/index.js";
import { validateDef } from "./constraints.js";
import { resolveFeature } from "./constraints.js";
import { classify } from "./classifier.js";
import {
  handA,
  handB,
  handC,
  handD,
  handL,
  fist,
  featuresOf,
} from "./letter-hands.js";
import { flatHand, setThumbTip } from "../geometry/test-hands.js";

test("ALPHABET covers exactly A, B, C, D, L for Phase 3", () => {
  assert.deepEqual(ALPHABET.map((d) => d.letter), ["A", "B", "C", "D", "L"]);
});

test("every definition is valid and every feature path resolves", () => {
  const features = featuresOf(flatHand());
  for (const def of ALPHABET) {
    validateDef(def);
    for (const c of def.constraints) {
      assert.ok(
        resolveFeature(features, c.feature) !== undefined,
        `${def.letter}/${c.id}: bad feature path "${c.feature}"`
      );
    }
  }
});

const CASES = [
  ["A", handA],
  ["B", handB],
  ["C", handC],
  ["D", handD],
  ["L", handL],
];

for (const [letter, build] of CASES) {
  test(`letter ${letter}: recognized, accepted, unambiguous`, () => {
    const result = classify(ALPHABET, featuresOf(build()));
    assert.equal(result.best.letter, letter);
    assert.ok(result.best.accepted, `score was ${result.best.score}`);
    assert.equal(result.ambiguous, false);
  });
}

test("each letter's worst runner-up is decisively separated", () => {
  // The synthetic matrix should never be within the ambiguity margin.
  for (const [letter, build] of CASES) {
    const { ranked } = classify(ALPHABET, featuresOf(build()));
    assert.ok(
      ranked[0].score - ranked[1].score > 0.08,
      `${letter}: runner-up ${ranked[1].letter} at ${ranked[1].score} vs ${ranked[0].score}`
    );
  }
});

test("a flat hand (thumb out) is not accepted as any Phase 3 letter", () => {
  const result = classify(ALPHABET, featuresOf(flatHand()));
  assert.equal(result.best.accepted, false);
});

test("a fist with the thumb wrapped across the front is not an A", () => {
  // A's critical constraint: thumb BESIDE the fist (signedNormal ≈ 0), not in
  // front (that's S, which arrives in Phase 4). Push the thumb tip out of
  // the palm plane → both thumb constraints fail → A must not be accepted.
  const sThumb = setThumbTip(fist(), [0.05, -0.7, 0.5]);
  const result = classify(ALPHABET, featuresOf(sThumb));
  const a = result.ranked.find((r) => r.letter === "A");
  assert.equal(a.accepted, false);
  assert.equal(result.best.accepted, false);
});
