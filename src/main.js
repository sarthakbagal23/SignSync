// Camera → landmarker → skeleton overlay → geometry → live feature inspector,
// driven once per decoded video frame (rVFC never double-runs or skips a
// frame, and feeds detectForVideo its monotonic timestamp).

import { startCamera } from "./vision/camera.js";
import { createLandmarker } from "./vision/landmarker.js";
import { drawOverlay, sizeCanvasToVideo } from "./ui/overlay.js";
import { createPipeline } from "./geometry/pipeline.js";
import { createDebugPanel } from "./ui/debug.js";
import { classify } from "./recognition/classifier.js";
import { ALPHABET } from "./recognition/letters/index.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const fpsEl = document.getElementById("fps");
const readingEl = document.getElementById("reading");
const debugPanel = createDebugPanel(document.getElementById("debug"));

const pipeline = createPipeline(0.4);

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

statusEl.classList.add("error"); // until we know the camera works

let landmarker;
let lastTimestamp = 0;
let fpsEMA = 0;
let lastFrameAt = 0;
let readingSig = "|"; // last rendered (class|text) for the reading element
let readingRenderedAt = 0;

function updateReading(verdict, now) {
  let text = "—";
  let cls = "";
  const b = verdict?.best;
  if (b) {
    if (verdict.ambiguous) {
      text = `between ${verdict.ambiguity.a} and ${verdict.ambiguity.b}…`;
      cls = "ambiguous";
    } else if (b.accepted) {
      text = `${b.letter} (${b.score.toFixed(2)})`;
      cls = "good";
    } else {
      text = `— (closest: ${b.letter}, ${b.score.toFixed(2)})`;
    }
  }
  const sig = `${cls}|${text}`;
  // Instant on change, at most every 500ms otherwise (score digits would
  // strobe at video framerate).
  if (sig === readingSig && now - readingRenderedAt < 500) return;
  readingEl.textContent = `Reading: ${text}`;
  readingEl.className = cls;
  readingSig = sig;
  readingRenderedAt = now;
}

function onFrame(now) {
  // detectForVideo demands a strictly increasing timestamp; performance.now()
  // is monotonic but this guard makes "strictly" guaranteed at any frame rate.
  const ts = Math.max(lastTimestamp + 1, performance.now());
  lastTimestamp = ts;

  const result = landmarker.detectForVideo(video, ts);

  sizeCanvasToVideo(canvas, video);
  const handVisible = drawOverlay(canvas, result);

  // Geometry uses worldLandmarks only (§2 gotcha #1: image landmarks are
  // aspect-distorted). The pipeline canonicalizes handedness, smooths the
  // palm frame, and computes features.
  const world = result?.worldLandmarks?.[0];
  const label = result?.handednesses?.[0]?.[0]?.categoryName ?? null;
  const out = world
    ? pipeline.step(
        world.map((p) => [p.x, p.y, p.z]),
        label
      )
    : null;

  debugPanel.update(out?.frame ?? null, out?.features ?? null, { label });

  // Live recognition readout (Phase 3 end-to-end validation). The full
  // coaching UI arrives later (§12); for now this is how we sanity-check
  // the engine against real hands. DOM writes are signature-gated: instant
  // when the verdict changes, score digits refresh at most 2×/second.
  const verdict = out ? classify(ALPHABET, out.features) : null;
  updateReading(verdict, now);

  // Rolling FPS (EMA smooths single-frame spikes).
  if (lastFrameAt > 0) {
    fpsEMA = fpsEMA ? fpsEMA * 0.9 + (1000 / (now - lastFrameAt)) * 0.1 : 1000 / (now - lastFrameAt);
    fpsEl.textContent = `${fpsEMA.toFixed(0)} fps`;
  }
  lastFrameAt = now;

  setStatus(handVisible ? "Hand detected" : "Show your hand to the camera");

  // note: rVFC only — no rAF fallback; Chrome/Edge/modern Safari all ship it
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
