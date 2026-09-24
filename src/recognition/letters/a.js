// Letter A (design §5.5): all four fingers curled into a fist; the thumb
// extended ALONGSIDE the fist (index side), not wrapped across the front —
// that's S (§5.3 tie-breaker A|S on thumb.signedNormal).
//
// PROVISIONAL thresholds on the §4.3 curl scale, where extended ≈ 0.05 and
// a real fist ≈ 0.54. Calibrate from capture data before trusting them.

export const A = {
  letter: "A",
  constraints: [
    {
      id: "a-curl-index",
      feature: "curl.index",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your index finger fully into your palm.",
    },
    {
      id: "a-curl-middle",
      feature: "curl.middle",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your middle finger fully into your palm.",
    },
    {
      id: "a-curl-ring",
      feature: "curl.ring",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your ring finger fully into your palm.",
    },
    {
      id: "a-curl-pinky",
      feature: "curl.pinky",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your pinky fully into your palm.",
    },
    {
      id: "a-thumb-beside",
      feature: "thumb.signedNormal",
      lo: -0.15, hi: 0.15, tol: 0.15, weight: 2, critical: true,
      fail: "Your thumb should rest alongside the fist, not wrap across the front of your fingers.",
      hint: "Think of it like a fist with the thumb riding alongside.",
    },
    {
      id: "a-thumb-index-side",
      feature: "thumb.lateral",
      lo: -1.0, hi: -0.35, tol: 0.3, weight: 2,
      fail: "Keep your thumb on the index-finger side of your fist.",
    },
  ],
};
