// Phase 2 — the capture tool (design §8): records the full feature vector
// (plus canonical landmarks, for later regression fixtures) to JSON while a
// teammate holds a given letter. Auto-captures when the hand is still, so a
// full 26-letter × 30-sample pass is a few minutes of holding shapes.

import { startCamera } from "./vision/camera.js";
import { createLandmarker } from "./vision/landmarker.js";
import { drawOverlay, sizeCanvasToVideo } from "./ui/overlay.js";
import { createPipeline } from "./geometry/pipeline.js";
import { createSampler } from "./capture/sampler.js";
import { createStore, LETTERS, TARGET_PER_LETTER } from "./capture/store.js";
import { createDebugPanel } from "./ui/debug.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const fpsEl = document.getElementById("fps");
const debugPanel = createDebugPanel(document.getElementById("debug"));

const currentLetterEl = document.getElementById("current-letter");
const currentCountEl = document.getElementById("current-count");
const stableEl = document.getElementById("stable-indicator");
const gridEl = document.getElementById("letter-grid");
const totalEl = document.getElementById("total-count");
const downloadBtn = document.getElementById("download");
const clearBtn = document.getElementById("clear");
const autoAdvanceEl = document.getElementById("auto-advance");

const pipeline = createPipeline(0.4);
const sampler = createSampler({ intervalMs: 400 });
const store = createStore();

let letter = "A";

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

// ---------- letter grid ----------

const gridButtons = new Map();

for (const L of LETTERS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = L;
  if (L === "J" || L === "Z") {
    btn.title = "J and Z are traced in motion later — capture the static base handshape only";
  }
  btn.addEventListener("click", () => selectLetter(L));
  gridEl.appendChild(btn);
  gridButtons.set(L, btn);
}

function selectLetter(L) {
  letter = L;
  for (const [k, b] of gridButtons) b.classList.toggle("current", k === L);
  refreshCounts();
}

function refreshCounts() {
  const counts = store.counts();
  let done = 0;
  for (const L of LETTERS) {
    const b = gridButtons.get(L);
    b.dataset.count = counts[L];
    b.classList.toggle("done", counts[L] >= TARGET_PER_LETTER);
    if (counts[L] >= TARGET_PER_LETTER) done++;
  }
  currentLetterEl.textContent = letter;
  currentCountEl.textContent = `${store.count(letter)}/${TARGET_PER_LETTER}`;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  totalEl.textContent = `${total} samples · ${done}/26 letters complete`;
}

function advance() {
  // Next letter (wrapping) that still needs samples; stay put when done.
  const start = LETTERS.indexOf(letter);
  for (let i = 1; i <= LETTERS.length; i++) {
    const L = LETTERS[(start + i) % LETTERS.length];
    if (store.remaining(L) > 0) {
      selectLetter(L);
      return;
    }
  }
}

// ---------- per-frame capture ----------

let flashTimer = 0;
function flash() {
  currentLetterEl.classList.remove("flash");
  void currentLetterEl.offsetWidth; // restart the CSS animation
  currentLetterEl.classList.add("flash");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => currentLetterEl.classList.remove("flash"), 350);
}

function setStable(stable) {
  stableEl.textContent = stable ? "steady — capturing" : "moving";
  stableEl.classList.toggle("stable", stable);
  stableEl.classList.toggle("unstable", !stable);
}

let landmarker;
let lastTimestamp = 0;
let fpsEMA = 0;
let lastFrameAt = 0;

function onFrame(now) {
  const ts = Math.max(lastTimestamp + 1, performance.now());
  lastTimestamp = ts;

  const result = landmarker.detectForVideo(video, ts);

  sizeCanvasToVideo(canvas, video);
  const handVisible = drawOverlay(canvas, result);

  const world = result?.worldLandmarks?.[0];
  const rawLabel = result?.handednesses?.[0]?.[0]?.categoryName ?? null;
  const out = world
    ? pipeline.step(
        world.map((p) => [p.x, p.y, p.z]),
        rawLabel
      )
    : null;

  if (out) {
    const { capture, stable } = sampler.tick(out.features);
    setStable(stable);
    debugPanel.update(out.frame, out.features, { label: rawLabel });

    if (capture) {
      store.add(letter, {
        t: ts,
        label: rawLabel,
        scale: out.frame.scale,
        landmarks: out.hand,
        features: out.features,
      });
      flash();
      refreshCounts();

      if (store.persistFailed) {
        setStatus("⚠ Local storage is full — download your JSON now!", true);
      } else if (
        autoAdvanceEl.checked &&
        store.remaining(letter) === 0
      ) {
        advance();
      }
    }
  } else {
    sampler.tick(null);
    setStable(false);
    debugPanel.update(null, null, null);
  }

  if (lastFrameAt > 0) {
    fpsEMA = fpsEMA ? fpsEMA * 0.9 + (1000 / (now - lastFrameAt)) * 0.1 : 1000 / (now - lastFrameAt);
    fpsEl.textContent = `${fpsEMA.toFixed(0)} fps`;
  }
  lastFrameAt = now;

  setStatus(handVisible ? `Capturing ${letter} — hold it steady` : "Show your hand to the camera");

  video.requestVideoFrameCallback(onFrame);
}

// ---------- actions ----------

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(store.exportPayload())], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `signsync-capture-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

clearBtn.addEventListener("click", () => {
  if (confirm("Delete ALL captured samples? Download them first if unsure.")) {
    store.clear();
    refreshCounts();
  }
});

// Typing a letter selects it — fast to drive during a collection session.
document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const L = e.key.toUpperCase();
  if (L.length === 1 && LETTERS.includes(L)) selectLetter(L);
});

// ---------- boot ----------

refreshCounts();
selectLetter("A");

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
