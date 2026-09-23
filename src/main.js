// Camera → landmarker → skeleton overlay → geometry → live feature inspector,
// driven once per decoded video frame (rVFC never double-runs or skips a
// frame, and feeds detectForVideo its monotonic timestamp).
import { startCamera } from "./vision/camera.js";
import { createLandmarker } from "./vision/landmarker.js";
import { drawOverlay, sizeCanvasToVideo } from "./ui/overlay.js";
import {
  canonicalHand,
  buildHandFrame,
  FrameSmoother,
} from "./geometry/normalize.js";
import { computeFeatures } from "./geometry/features.js";
import { createDebugPanel } from "./ui/debug.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const fpsEl = document.getElementById("fps");
const debugPanel = createDebugPanel(document.getElementById("debug"));

// §4.2: smooth the palm-frame basis across frames, then re-orthonormalize.
const smoother = new FrameSmoother(0.4);

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

statusEl.classList.add("error"); // until we know the camera works

let landmarker;
let lastTimestamp = 0;
let fpsEMA = 0;
let lastFrameAt = 0;

function updateInspector(result) {
  const world = result?.worldLandmarks?.[0];
  if (!world) {
    smoother.reset(); // re-seed on reappearance — no stale blending
    debugPanel.update(null, null, null);
    return;
  }

  // Geometry uses worldLandmarks only (§2 gotcha #1: image landmarks are
  // aspect-distorted).
  const raw = world.map((p) => [p.x, p.y, p.z]);
  const label = result.handednesses?.[0]?.[0]?.categoryName ?? null;
  const hand = canonicalHand(raw, label);

  const rawFrame = buildHandFrame(hand);
  const basis = smoother.smooth(rawFrame.uWorld, rawFrame.wWorld);
  const frame = buildHandFrame(hand, basis);

  debugPanel.update(frame, computeFeatures(frame), { label });
}

function onFrame(now) {
  // detectForVideo demands a strictly increasing timestamp; performance.now()
  // is monotonic but this guard makes "strictly" guaranteed at any frame rate.
  const ts = Math.max(lastTimestamp + 1, performance.now());
  lastTimestamp = ts;

  const result = landmarker.detectForVideo(video, ts);

  sizeCanvasToVideo(canvas, video);
  const handVisible = drawOverlay(canvas, result);
  updateInspector(result);

  // Rolling FPS (EMA smooths single-frame spikes).
  if (lastFrameAt > 0) {
    fpsEMA = fpsEMA ? fpsEMA * 0.9 + (1000 / (now - lastFrameAt)) * 0.1 : 1000 / (now - lastFrameAt);
    fpsEl.textContent = `${fpsEMA.toFixed(0)} fps`;
  }
  lastFrameAt = now;

  setStatus(handVisible ? "Hand detected" : "Show your hand to the camera");

  // ponytail: rVFC only — no rAF fallback; Chrome/Edge/modern Safari all ship it
  video.requestVideoFrameCallback(onFrame);
}

try {
  setStatus("Requesting camera…");
  await startCamera(video);
  setStatus("Loading hand tracker…");
  landmarker = await createLandmarker();
  setStatus("Show your hand to the camera");
  video.requestVideoFrameCallback(onFrame);
} catch (err) {
  const userFacing = err.userFacing === true;
  setStatus(
    userFacing
      ? err.message
      : "Hand tracker failed to load — did you run `npm run setup`? See console.",
    true
  );
  console.error(err);
}
