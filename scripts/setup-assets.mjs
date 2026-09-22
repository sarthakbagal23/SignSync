// One-time asset setup: copies the MediaPipe WASM runtime out of node_modules
// into public/ and downloads the hand-landmarker model, so dev AND production
// builds never touch a CDN (that's the offline claim — verify in airplane mode).
// Re-run after upgrading @mediapipe/tasks-vision (the wasm version must match).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

mkdirSync(join(root, "public", "models"), { recursive: true });
mkdirSync(join(root, "public", "mediapipe"), { recursive: true });

cpSync(
  join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm"),
  join(root, "public", "mediapipe", "wasm"),
  { recursive: true }
);
console.log("Copied WASM runtime -> public/mediapipe/wasm");

const modelPath = join(root, "public", "models", "hand_landmarker.task");
if (existsSync(modelPath)) {
  console.log("Model already present -> public/models/hand_landmarker.task");
} else {
  console.log("Downloading hand_landmarker.task (~7.8 MB)...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(modelPath, buf);
  console.log(`Model saved -> public/models/hand_landmarker.task (${(buf.length / 1e6).toFixed(1)} MB)`);
}

console.log("Done. SignSync is offline-capable.");
