// Tests for the classifier (design §5.2–5.3): weighted geometric-mean
// scoring with a 0.01 floor, the critical gate, ranking, the ambiguity
// margin, and tie-breakers.

import test from "node:test";
import assert from "node:assert/strict";

import {
  scoreLetter,
  classify,
  ACCEPT_THRESHOLD,
  CRITICAL_FLOOR,
  AMBIGUITY_MARGIN,
} from "./classifier.js";

// Tiny feature-vector factory: only what the constraints below read.
const features = (index = 0.1, middle = 0.1) => ({
  curl: { index, middle },
});

const C = (id, feature, lo, hi, tol, weight, extra = {}) => ({
  id,
  feature,
  lo,
  hi,
  tol,
  weight,
  ...extra,
});

test("§5.2 tuning constants", () => {
  assert.equal(ACCEPT_THRESHOLD, 0.75);
  assert.equal(CRITICAL_FLOOR, 0.5);
  assert.ok(Math.abs(AMBIGUITY_MARGIN - 0.08) < 1e-12);
});

test("scoreLetter returns 1 when every constraint is fully satisfied", () => {
  const def = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.2, 1),
      C("x2", "curl.middle", 0, 0.2, 0.4, 1),
    ],
  };
  const r = scoreLetter(def, features());
  assert.ok(Math.abs(r.score - 1) < 1e-12);
  assert.equal(r.accepted, true);
  assert.equal(r.criticalFailure, null);
});

test("score is the weighted geometric mean of satisfactions", () => {
  const def = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.2, 1),
      C("x2", "curl.middle", 0, 0.2, 0.4, 1),
    ],
  };
  // middle 0.4 → s = 1 − (0.4−0.2)/0.4 = 0.5 → score = √0.5
  const r = scoreLetter(def, features(0.1, 0.4));
  assert.ok(Math.abs(r.score - Math.SQRT1_2) < 1e-12);
  assert.equal(r.accepted, false); // 0.707… < 0.75 → below the gate
});

test("a zero satisfaction is floored at 0.01 — one failure cannot annihilate everything, but it hurts", () => {
  const def = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.2, 1),
      C("x2", "curl.middle", 0, 0.2, 0.4, 1),
    ],
  };
  const r = scoreLetter(def, features(0.1, 1.0)); // middle way out of band
  assert.ok(Math.abs(r.score - 0.1) < 1e-12); // √0.01
});

test("weights drag the geometric mean proportionally", () => {
  const failHeavy = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.4, 3), // s = 0.5, heavy
      C("x2", "curl.middle", 0, 0.2, 0.2, 1), // s = 1
    ],
  };
  const failLight = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.4, 1), // s = 0.5, light
      C("x2", "curl.middle", 0, 0.2, 0.2, 3), // s = 1
    ],
  };
  const heavy = scoreLetter(failHeavy, features(0.4, 0.1)).score;
  const light = scoreLetter(failLight, features(0.4, 0.1)).score;
  // 0.5^(3/4) vs 0.5^(1/4)
  assert.ok(Math.abs(heavy - Math.exp((3 * Math.log(0.5)) / 4)) < 1e-12);
  assert.ok(Math.abs(light - Math.exp((1 * Math.log(0.5)) / 4)) < 1e-12);
  assert.ok(light > heavy);
});

test("a critical constraint below 0.5 blocks acceptance despite a high score", () => {
  const def = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.5, 0.1, { critical: true }), // s = 0.4
      C("x2", "curl.middle", 0, 0.2, 0.2, 3), // s = 1
    ],
  };
  const r = scoreLetter(def, features(0.5, 0.1)); // index 0.5 → s = 0.4
  assert.ok(r.score > 0.95); // score sails over the threshold…
  assert.equal(r.accepted, false); // …but the critical gate rejects it
  assert.equal(r.criticalFailure.constraint.id, "x1");
});

test("failures are ranked by weight × (1 − satisfaction)", () => {
  const def = {
    letter: "X",
    constraints: [
      C("x1", "curl.index", 0, 0.2, 0.4, 1), // s = 0.5  → 1×0.5 = 0.5
      C("x2", "curl.middle", 0, 0.2, 0.2, 3), // s = 1 → 0
    ],
  };
  const r = scoreLetter(def, features(0.4, 0.1));
  assert.equal(r.failures[0].constraint.id, "x1");
  assert.equal(r.failures[1].constraint.id, "x2");
});

test("an empty constraint set throws", () => {
  assert.throws(() => scoreLetter({ letter: "X", constraints: [] }, features()));
});

test("classify ranks all definitions and reports the best", () => {
  const defs = [
    {
      letter: "X",
      constraints: [C("x1", "curl.index", 0, 0.2, 0.2, 1), C("x2", "curl.middle", 0, 0.2, 0.4, 1)],
    },
    {
      letter: "Y",
      constraints: [C("y1", "curl.index", 0, 1, 1, 1), C("y2", "curl.middle", 0, 1, 1, 1)],
    },
  ];
  const result = classify(defs, features(0.1, 0.9)); // X's middle fails hard
  assert.equal(result.best.letter, "Y");
  assert.ok(result.best.accepted);
  assert.equal(result.ambiguous, false);
  assert.deepEqual(result.ranked.map((r) => r.letter), ["Y", "X"]);
});

test("top two within the margin surface as ambiguity when no tie-breaker applies", () => {
  const defs = [
    {
      letter: "P",
      constraints: [C("p1", "curl.index", 0, 0.2, 0.2, 1), C("p2", "curl.middle", 0, 0.2, 0.2, 1)],
    },
    {
      letter: "Q",
      constraints: [C("q1", "curl.index", 0, 0.2, 0.2, 1), C("q2", "curl.middle", 0, 0.2, 0.2, 1)],
    },
  ];
  const result = classify(defs, features(), { tieBreakers: {} });
  assert.equal(result.best.score, 1);
  assert.equal(result.ambiguous, true);
  assert.deepEqual(result.ambiguity, { a: "P", b: "Q" });
});

test("a tie-breaker resolves close scores via the discriminative feature", () => {
  const tieBreakers = { "P|Q": { feature: "curl.index" } };

  // Case A — the leader also wins the tie-break (no reorder):
  // P 1.0 (index 0.1 inside its band), Q 0.5^0.005 ≈ 0.997 (tiny-weighted miss)
  const leaders = [
    {
      letter: "P",
      constraints: [C("p1", "curl.index", 0, 0.2, 0.2, 5), C("p2", "curl.middle", 0, 0.2, 0.2, 5)],
    },
    {
      letter: "Q",
      constraints: [
        C("q1", "curl.index", 0.2, 0.4, 0.2, 0.05), // barely weighted
        C("q2", "curl.middle", 0, 0.2, 0.2, 9.95),
      ],
    },
  ];
  const a = classify(leaders, features(0.1, 0.1), { tieBreakers });
  assert.equal(a.ambiguous, false);
  assert.equal(a.best.letter, "P");
  assert.deepEqual(a.tieBreak, { feature: "curl.index", value: 0.1, winner: "P", loser: "Q" });

  // Case B — the runner-up wins the tie-break and must be PROMOTED:
  // Q scores 0.983 (tiny-weighted index miss) vs P 0.949 (mild middle miss)
  // → gap 0.035 < margin → tie; but P's index band is the satisfied one.
  const promotable = [
    {
      letter: "P",
      constraints: [
        C("p1", "curl.index", 0, 0.2, 0.2, 1), // s = 1
        C("p2", "curl.middle", 0.15, 0.2, 0.5, 1), // s = 0.9
      ],
    },
    {
      letter: "Q",
      constraints: [
        C("q1", "curl.index", 0.2, 0.4, 0.2, 0.1), // s = 0.5, tiny weight
        C("q2", "curl.middle", 0, 0.2, 0.2, 4), // s = 1
      ],
    },
  ];
  const b = classify(promotable, features(0.1, 0.1), { tieBreakers });
  assert.equal(b.ambiguous, false);
  assert.equal(b.best.letter, "P"); // promoted from runner-up
  assert.equal(b.tieBreak.winner, "P");
  assert.equal(b.tieBreak.loser, "Q");
});

test("a tie-breaker that cannot separate falls back to ambiguity", () => {
  const defs = [
    {
      letter: "P",
      constraints: [C("p1", "curl.index", 0, 1, 1, 1)],
    },
    {
      letter: "Q",
      constraints: [C("q1", "curl.index", 0, 1, 1, 1)],
    },
  ];
  // Same band on the tie-break feature → unresolved → ambiguous
  const result = classify(defs, features(0.1), {
    tieBreakers: { "P|Q": { feature: "curl.index" } },
  });
  assert.equal(result.ambiguous, true);
});

test("a single definition never triggers ambiguity", () => {
  const defs = [{ letter: "X", constraints: [C("x1", "curl.index", 0, 0.2, 0.2, 1)] }];
  const result = classify(defs, features());
  assert.equal(result.best.letter, "X");
  assert.equal(result.ambiguous, false);
  assert.equal(result.ambiguity, null);
});
