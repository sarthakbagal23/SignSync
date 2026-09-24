// Classifier (design §5.2–5.3): weighted geometric-mean scoring with a
// small floor, a two-condition acceptance gate, ranking, an ambiguity
// margin, and tie-breakers for confusable pairs.

import { satisfy, resolveFeature } from "./constraints.js";

// §5.2 tuning constants — starting points, tune empirically from capture data.
export const ACCEPT_THRESHOLD = 0.75;
export const CRITICAL_FLOOR = 0.5;
export const AMBIGUITY_MARGIN = 0.08;

// Confusable pairs → the single most discriminative feature for that pair
// (§5.3). Keys are "L1|L2" in alphabetical order. Letters land letter-by-
// letter; a pair becomes active the moment both of its letters exist.
export const TIE_BREAKERS = {
  "A|S": { feature: "thumb.signedNormal", comment: "A: thumb beside the fist (≈0); S: wrapped across the front (>0)" },
  "K|P": { feature: "orientation.pointing[1]", comment: "world y is down in MediaPipe space: K points up (negative), P down (positive)" },
  "M|N": { feature: "thumb.lateral", comment: "how far across the fist the thumb tip has traveled (N: 2 fingers, M: 3)" },
  "U|V": { feature: "spread.indexMiddle", comment: "V splays the two fingers; U keeps them together" },
};

// Score one letter against the current feature vector.
export function scoreLetter(def, features) {
  let weightSum = 0;
  let logSum = 0;
  const perConstraint = [];
  let criticalFailure = null;

  for (const c of def.constraints) {
    const value = resolveFeature(features, c.feature);
    const s = satisfy(value, c.lo, c.hi, c.tol);
    weightSum += c.weight;
    logSum += c.weight * Math.log(Math.max(s, 0.01)); // floor: one zero ≠ annihilation
    const entry = { constraint: c, value, satisfaction: s };
    perConstraint.push(entry);
    if (
      c.critical &&
      s < CRITICAL_FLOOR &&
      (!criticalFailure || s < criticalFailure.satisfaction)
    ) {
      criticalFailure = entry;
    }
  }

  if (weightSum === 0) throw new Error(`Letter ${def.letter}: constraints carry no weight`);

  const score = Math.exp(logSum / weightSum);

  // For §5.4 feedback later: rank failures by weight × (1 − satisfaction).
  const failures = [...perConstraint].sort(
    (a, b) =>
      b.constraint.weight * (1 - b.satisfaction) -
      a.constraint.weight * (1 - a.satisfaction)
  );

  return {
    letter: def.letter,
    score,
    // §5.2: two gates, not one — no high average may paper over a
    // disqualifying error.
    accepted: score >= ACCEPT_THRESHOLD && !criticalFailure,
    criticalFailure,
    perConstraint,
    failures,
  };
}

// Try to settle a close top-two with the pair's discriminative feature.
// Returns { winner, loser, feature, value } or null when unresolvable.
function tieBreak(top, second, features, tieBreakers) {
  const key = [top.letter, second.letter].sort().join("|");
  const entry = tieBreakers[key];
  if (!entry) return null;

  const value = resolveFeature(features, entry.feature);
  const satOf = (result) => {
    const e = result.perConstraint.find(
      (p) => p.constraint.feature === entry.feature
    );
    if (!e) return null; // this letter doesn't constrain the feature — can't judge
    return satisfy(value, e.constraint.lo, e.constraint.hi, e.constraint.tol);
  };
  const sTop = satOf(top);
  const sSecond = satOf(second);
  if (sTop === null || sSecond === null || sTop === sSecond) return null;

  return sTop > sSecond
    ? { winner: top, loser: second, feature: entry.feature, value }
    : { winner: second, loser: top, feature: entry.feature, value };
}

// Score every definition, rank, and handle the §5.3 ambiguity contract.
export function classify(
  definitions,
  features,
  { margin = AMBIGUITY_MARGIN, tieBreakers = TIE_BREAKERS } = {}
) {
  const ranked = definitions
    .map((d) => scoreLetter(d, features))
    .sort((a, b) => b.score - a.score);

  let ambiguous = false;
  let ambiguity = null;
  let tieBreakInfo = null;

  if (ranked.length > 1 && ranked[0].score - ranked[1].score < margin) {
    const tb = tieBreak(ranked[0], ranked[1], features, tieBreakers);
    if (tb) {
      tieBreakInfo = {
        feature: tb.feature,
        value: tb.value,
        winner: tb.winner.letter,
        loser: tb.loser.letter,
      };
      if (tb.winner !== ranked[0]) {
        [ranked[0], ranked[1]] = [ranked[1], ranked[0]];
      }
    } else {
      // Surface it: "somewhere between M and N" beats a confident wrong guess.
      ambiguous = true;
      ambiguity = { a: ranked[0].letter, b: ranked[1].letter };
    }
  }

  return { ranked, best: ranked[0] ?? null, ambiguous, ambiguity, tieBreak: tieBreakInfo };
}
