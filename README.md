# SignSync

Real-time ASL fingerspelling practice coach. Fully client-side — video never
leaves the device.

## Setup

```sh
npm install
npm run setup   # copies WASM + downloads the hand-landmarker model into public/
npm run dev
```

`npm run setup` requires internet **once**, to fetch the model. After that the
app runs with zero network access — verify with your machine in airplane mode.

## Design

The full technical design (architecture, geometry math, recognition engine,
build order, risk register) lives in [docs/design.md](docs/design.md).

## Capture tool (Phase 2)

`npm run dev`, then open the **capture tool** link (or `/capture.html`).

It records the full feature vector + canonical landmarks while you hold a
letter's handshape, auto-capturing ~2.5×/s whenever your hand is steady.

Workflow for threshold calibration (design §8):

1. Click or type a letter, hold the handshape until it hits **30/30**
   (auto-advance moves to the next letter).
2. Vary lighting, distance, and angle between passes; get every teammate.
3. **Download JSON** and keep the file — it feeds both constraint tuning
   and the regression fixture suite. Samples also persist in localStorage
   across reloads.
4. J and Z: record the static base handshape only; their motion is handled
   in a later phase.

The JSON is your own data, collected on your own hands — the thresholds that
make the recognizer robust come from it, not from guesses.

## Live recognition (Phase 3)

The main page now shows a live **Reading** line under the camera view: the
best-scoring letter and its score, `between X and Y…` when the top two are
too close to call, or the closest letter when nothing clears the acceptance
gate (score ≥ 0.75 with no disqualifying error).

Five letters ship for now — **A, B, C, D, L** — chosen to be visually
distinct so they validate the whole pipeline before the rest of the
alphabet lands. Their thresholds are provisional synthetic-scale values;
real-hand calibration happens against capture data (§8).

Hold a hand up at <http://localhost:5173> and the Reading line is the fastest
way to sanity-check the engine: an A-hand should read `A (0.9x)`, a B-hand
`B (0.9x)`, and deliberately sloppy shapes should read `— (closest: …)`.
