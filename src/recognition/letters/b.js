// Letter B (design §5.5): four fingers extended and held together, thumb
// folded across the palm. PROVISIONAL thresholds — calibrate from data.

export const B = {
  letter: "B",
  constraints: [
    {
      id: "b-curl-index",
      feature: "curl.index",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Hold your index finger flat and extended.",
    },
    {
      id: "b-curl-middle",
      feature: "curl.middle",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Hold your middle finger flat and extended.",
    },
    {
      id: "b-curl-ring",
      feature: "curl.ring",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Hold your ring finger flat and extended.",
    },
    {
      id: "b-curl-pinky",
      feature: "curl.pinky",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Hold your pinky flat and extended.",
    },
    {
      id: "b-fingers-together",
      feature: "spread.indexMiddle",
      lo: 0, hi: 0.25, tol: 0.15, weight: 2, critical: true,
      fail: "Hold your fingers together — B is a flat hand, not a spread one.",
    },
    {
      id: "b-spread-middle-ring",
      feature: "spread.middleRing",
      lo: 0, hi: 0.25, tol: 0.15, weight: 1,
      fail: "Close the gap between your middle and ring fingers.",
    },
    {
      id: "b-spread-ring-pinky",
      feature: "spread.ringPinky",
      lo: 0, hi: 0.25, tol: 0.15, weight: 1,
      fail: "Close the gap between your ring finger and pinky.",
    },
    {
      id: "b-thumb-across",
      feature: "thumb.lateral",
      lo: 0.05, hi: 1.0, tol: 0.25, weight: 2, critical: true,
      fail: "Fold your thumb across your palm.",
    },
    {
      id: "b-thumb-in-plane",
      feature: "thumb.signedNormal",
      lo: -0.2, hi: 0.2, tol: 0.2, weight: 1,
      fail: "Let your thumb rest flat across the palm, not sticking out in front.",
    },
  ],
};
