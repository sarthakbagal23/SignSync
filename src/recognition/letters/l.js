// Letter L (design §5.5): index finger extended up, thumb extended out
// roughly perpendicular, middle/ring/pinky curled. Separated from D purely
// by the thumb: D brings it to the middle fingertip; L sticks it out sideways.
// PROVISIONAL thresholds — calibrate from capture data.

export const L = {
  letter: "L",
  constraints: [
    {
      id: "l-index-extended",
      feature: "curl.index",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Point your index finger straight up.",
    },
    {
      id: "l-curl-middle",
      feature: "curl.middle",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your middle finger into your palm.",
    },
    {
      id: "l-curl-ring",
      feature: "curl.ring",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your ring finger into your palm.",
    },
    {
      id: "l-curl-pinky",
      feature: "curl.pinky",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your pinky into your palm.",
    },
    {
      id: "l-thumb-out",
      feature: "thumb.lateral",
      lo: -1.2, hi: -0.35, tol: 0.25, weight: 3, critical: true,
      fail: "Stick your thumb out sideways — L is a right angle between index and thumb.",
      hint: "Think of the capital letter L your hand makes.",
    },
    {
      id: "l-thumb-in-plane",
      feature: "thumb.signedNormal",
      lo: -0.2, hi: 0.2, tol: 0.2, weight: 1,
      fail: "Keep your thumb flat in the plane of your palm, pointing sideways.",
    },
  ],
};
