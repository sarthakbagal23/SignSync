// Skeleton overlay. Deliberately draws from `landmarks` (image-normalized
// coords) — the aspect-distorted channel is CORRECT here because it maps 1:1
// onto video pixels. All geometry/recognition must use worldLandmarks (design §2).

// Canonical 21-landmark connection graph from the MediaPipe docs.
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // index
  [5, 9], [9, 10], [10, 11], [11, 12],      // middle
  [9, 13], [13, 14], [14, 15], [15, 16],    // ring
  [13, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [0, 17],                                  // palm base
];

// Match the canvas's internal resolution to the video's real pixel size once;
// after that, drawing in video-pixel space keeps the skeleton aligned at any
// window size (which is the Phase 0 "no offset" done-criterion).
export function sizeCanvasToVideo(canvas, video) {
  if (video.videoWidth && canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

export function drawOverlay(canvas, result) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);

  const hand = result?.landmarks?.[0];
  if (!hand) return false;

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(77, 163, 255, 0.9)";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(hand[a].x * w, hand[a].y * h);
    ctx.lineTo(hand[b].x * w, hand[b].y * h);
  }
  ctx.stroke();

  ctx.fillStyle = "#e8eaf0";
  for (const p of hand) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}
