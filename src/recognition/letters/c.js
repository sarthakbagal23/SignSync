// Letter C (design §5.5): fingers curved into a C, thumb curving opposite
// them to form an open arc, roughly in the palm plane. PROVISIONAL
// thresholds — the half-curled band especially needs capture data.

export const C = {
  letter: "C",
  constraints: [
    {
      id: "c-curl-index",
      feature: "curl.index",
      lo: 0.15, hi: 0.42, tol: 0.12, weight: 3, critical: true,
      fail: "Curve your index finger — C is a half-open arc, not flat and not a fist.",
    },
    {
      id: "c-curl-middle",
      feature: "curl.middle",
      lo: 0.15, hi: 0.42, tol: 0.12, weight: 3, critical: true,
      fail: "Curve your middle finger to match the C shape.",
    },
    {
      id: "c-curl-ring",
      feature: "curl.ring",
      lo: 0.15, hi: 0.42, tol: 0.12, weight: 3, critical: true,
      fail: "Curve your ring finger to match the C shape.",
    },
    {
      id: "c-curl-pinky",
      feature: "curl.pinky",
      lo: 0.15, hi: 0.42, tol: 0.12, weight: 3, critical: true,
      fail: "Curve your pinky to match the C shape.",
    },
    {
      id: "c-thumb-opposite",
      feature: "thumb.lateral",
      lo: -1.0, hi: -0.35, tol: 0.25, weight: 2, critical: true,
      fail: "Bring your thumb around to face your fingers — it forms the bottom of the C.",
    },
    {
      id: "c-thumb-in-plane",
      feature: "thumb.signedNormal",
      lo: -0.15, hi: 0.15, tol: 0.15, weight: 1,
      fail: "Keep your thumb curving in the same plane as your fingers.",
    },
  ],
};
