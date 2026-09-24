// Letter D (design §5.5): index finger extended; middle, ring and pinky
// curled to meet the thumb, whose tip contacts the middle fingertip.
// PROVISIONAL thresholds — calibrate from capture data.

export const D = {
  letter: "D",
  constraints: [
    {
      id: "d-index-extended",
      feature: "curl.index",
      lo: 0, hi: 0.15, tol: 0.15, weight: 3, critical: true,
      fail: "Point your index finger straight up.",
    },
    {
      id: "d-curl-middle",
      feature: "curl.middle",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your middle finger down to touch your thumb.",
    },
    {
      id: "d-curl-ring",
      feature: "curl.ring",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your ring finger down toward your thumb.",
    },
    {
      id: "d-curl-pinky",
      feature: "curl.pinky",
      lo: 0.45, hi: 1, tol: 0.15, weight: 3, critical: true,
      fail: "Curl your pinky down toward your thumb.",
    },
    {
      id: "d-thumb-middle-contact",
      feature: "thumb.tipDist.middle",
      lo: 0, hi: 0.15, tol: 0.2, weight: 4, critical: true,
      fail: "Touch the tip of your thumb to your middle fingertip.",
      hint: "Your middle, ring and pinky curl to MEET the thumb.",
    },
  ],
};
