// MediaPipe HandLandmarker init. Tasks API (vision/tasks-vision), VIDEO mode, one hand.
// ponytail: WASM + model live in public/ (copied by `npm run setup`) so nothing
// loads from a CDN — that is the entire offline claim. Verify in airplane mode.
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_DIR = "/mediapipe/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";

async function create(delegate) {
  const vision = await FilesetResolver.forVisionTasks(WASM_DIR);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "VIDEO",
    numHands: 1, // Phase 0: single dominant hand; raise later per design §5.3
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function createLandmarker() {
  try {
    return await create("GPU");
  } catch (gpuErr) {
    // Risk register: the demo laptop may not expose a GPU delegate. Know the
    // CPU framerate before the event instead of discovering it on stage.
    console.warn("GPU delegate unavailable, falling back to CPU:", gpuErr);
    return create("CPU");
  }
}
