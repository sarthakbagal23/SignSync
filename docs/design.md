# SignSync — Technical Design Document

> Drafted under the working name **SignSense**; project renamed **SignSync**.
> Content below is the design as drafted and reviewed — 13 sections plus the
> Phase 0 exit criteria in Appendix A.

A real-time ASL fingerspelling practice coach. Browser-based, fully client-side, built on MediaPipe hand landmarks with a hand-authored geometric constraint engine.

This document is a design spec, not code. It describes the architecture, the math, the data structures, and the failure modes, at the level of detail where implementing it is mechanical but still yours. Every algorithm here is something you should be able to defend at a judging table.

## 1. Idea validation

### What holds up

The demo story is the strongest part. Live webcam recognition in front of judges, with a judge invited to try a letter, is a qualitatively different experience from clicking through a quiz app. It also proves robustness in a way a screen recording never can.

The pedagogical claim is real. Fingerspelling is one of the few ASL skills where a learner can practice for weeks in front of a mirror and fossilize a wrong handshape, because a mirror shows you what you're doing but not what you should be doing. Corrective feedback is the actual missing ingredient, not more video content.

Client-side execution is a genuine differentiator, not just a hedge against bad venue Wi-Fi. It also means no video ever leaves the device, which is a privacy story worth putting on a slide.

Explainability is the sleeper advantage. A neural classifier would be a black box you can't defend. Geometry over 21 landmarks is something you can walk a judge through line by line.

### What the pitch glossed over

J and Z are not static. Two of the 26 letters require motion and cannot be recognized from a single frame. You need a temporal layer. This is not optional and it's the first thing a technically literate judge will ask about.

Several letters are literally the same handshape. Not "similar" — identical:

| Pair | Relationship |
|------|--------------|
| 2 / V | identical handshape |
| 6 / W | identical handshape |
| 9 / F | identical handshape |
| K / P | same handshape, different orientation |
| G / Q | same handshape, different orientation |

No classifier can separate 9 from F from geometry alone, because there is no geometric difference. The fix is architectural: alphabet mode and number mode are separate candidate sets, and the classifier never scores both at once. K/P and G/Q are separable only if you keep world-frame orientation features (see §4.4).

The closed-fist family is the hard part. A, S, T, M, N, E all share "four fingers curled" and differ only in thumb placement — and the thumb is frequently occluded by the fingers, meaning MediaPipe is estimating landmarks it cannot actually see. Expect this family to consume a disproportionate share of your tuning time. Budget for it. Do not schedule it early to "get the alphabet done."

Corrective feedback is harder than classification. "That's not an A" is easy. "Your thumb should lie flat against the side of your index finger, not cross in front of it" requires knowing which specific geometric property failed. This drives the entire architecture below.

### The core architectural decision

Do not build a classifier and bolt feedback onto it. Build a constraint system where classification and feedback are the same mechanism read two different ways:

- **Classification** = which letter has the highest constraint satisfaction?
- **Feedback** = for the target letter, which constraint is failing worst, and what does its failure message say?

This single decision gives you explainable code, actionable tutoring, and confusion detection for free.

## 2. Stack

Vanilla JS + Vite — correct for this. No framework tax on a canvas/video hot loop, near-instant HMR, tiny bundle, and judges can read the source without knowing React. The tradeoff is that you must impose structure yourself; see §7.

MediaPipe — use @mediapipe/tasks-vision (the current Tasks API), not the legacy @mediapipe/hands solution. The legacy package is deprecated and has a worse API.

```js
HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: <local path>, delegate: "GPU" },
  runningMode: "VIDEO",
  numHands: 1,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
})
```

### Three gotchas that will cost you a day each if you miss them

1. **Use worldLandmarks, not landmarks, for all geometry.** The landmarks array is normalized to image coordinates, which means it is aspect-ratio distorted — a 16:9 frame stretches x relative to y. Every angle you compute from it will be wrong, and wrong in a way that changes when someone resizes the window. worldLandmarks gives approximate metric 3D coordinates centered at the hand's geometric center. Use landmarks only for drawing the overlay on the canvas.

2. **Bundle the .wasm and .task files locally.** The "internet-proof" claim in your pitch is not automatic — the default setup pulls the WASM runtime and the model from a CDN. Copy them into public/ and reference local paths, then verify by loading the app with your laptop in airplane mode. Do this in week one, not the night before the demo.

3. **Drive the loop with requestVideoFrameCallback, not requestAnimationFrame.** rVFC fires once per actual decoded video frame, so you never run inference twice on the same frame or skip one. Pass a monotonically increasing timestamp to detectForVideo() — reusing or decreasing a timestamp causes silent misbehavior.

## 3. Landmark reference

MediaPipe returns 21 points per hand:

```
0     wrist
1-4   thumb:  CMC, MCP, IP,  TIP
5-8   index:  MCP, PIP, DIP, TIP
9-12  middle: MCP, PIP, DIP, TIP
13-16 ring:   MCP, PIP, DIP, TIP
17-20 pinky:  MCP, PIP, DIP, TIP
```

Useful rigid distances (they don't change with finger flexion, so they're good scale references): wrist→middle MCP (0→9), and palm width (5→17).

## 4. Geometry layer

This is the heart of the project. Get it right and everything downstream is straightforward.

### 4.1 Handedness normalization

Left-handed signers mirror every sign. Rather than authoring two constraint sets, normalize to a canonical right hand:

1. Read the handedness label from the detection result.
2. If left, negate the x coordinate of every landmark.
3. Classify with the right-hand constraint set.

Two traps. First, MediaPipe reports handedness from the camera's point of view, and your preview video is almost certainly mirrored with transform: scaleX(-1) for usability — so the label may read opposite to what the user experiences. Pick a convention, write it down in a comment, and test with an actual left-handed teammate. Second, mirroring flips the sign of your palm normal, so apply the mirror before building the coordinate frame, not after.

### 4.2 Normalization pipeline

**Translate.** Subtract the wrist position so landmark 0 is the origin.

**Scale.** Divide all coordinates by ‖L9 − L0‖ (wrist to middle knuckle). This is rigid regardless of finger position, so it gives a stable scale across different hand sizes and distances from the camera.

**Rotate into the palm frame.** You want a local coordinate system attached to the hand.

Do not build the palm normal from a cross product of just two vectors. MediaPipe's z estimates are the noisiest channel, and a 3-point normal inherits all of that noise. Instead, fit a plane by PCA over the six palm-adjacent landmarks {0, 1, 5, 9, 13, 17}:

- Center those six points on their centroid.
- Build the 3×3 covariance matrix.
- Take the eigenvector with the smallest eigenvalue — that's the plane normal w.
- Disambiguate the sign of w so it consistently points out of the palm (check it against the cross product of L5−L0 and L17−L0; flip if the dot product is negative).

Then:

```
u = normalize(L9 − L0)        // palm "up" (wrist → middle knuckle)
u = normalize(u − (u·w)w)     // orthogonalize against w
v = cross(w, u)               // palm "right"
R = [v u w]ᵀ                  // rotation into palm frame
```

A 3×3 eigendecomposition is about 40 lines of hand-written code (or use the closed-form solution for symmetric 3×3 matrices). Writing it yourself is a good judging talking point.

**Smooth the frame.** Apply an exponential moving average to the basis vectors across frames, then re-orthonormalize with Gram-Schmidt. Without this, the skeleton overlay jitters visibly and your orientation-dependent features (K/P, G/Q) flicker.

**Keep both frames.** Store the palm-frame coordinates and the world-frame u/w vectors. Shape features come from the palm frame. Orientation features come from the world frame. You need both.

### 4.3 Shape features (palm frame)

**Finger curl, per finger.** For each of index/middle/ring/pinky, compute the cosine of the interior angle at the PIP joint and at the MCP joint, then combine:

```
curl(f) = 1 − (angle_MCP + angle_PIP) / (2π)
```

Roughly 0 for a fully extended finger, approaching 1 for a fully curled one. Angles are more robust than the tip-to-MCP distance ratio, because distance ratios degrade when the finger points toward or away from the camera.

**Finger spread, between adjacent fingers.** Project each finger's MCP→TIP direction into the palm plane (drop the w component), then take the angle between adjacent projections. This is what separates U from V.

**Finger crossing, for R.** Compute the lateral (v-axis) coordinate of the index and middle tips relative to their own MCPs. In a normal two-finger extension the signs match the MCP ordering; when crossed, they swap. A sign flip is a clean, binary, explainable test.

**Thumb metrics.** The thumb needs its own feature family because the entire closed-fist group depends on it:

- Distance from thumb tip to each of the four fingertips, scaled — catches F (thumb–index contact), D (thumb–middle contact), O (thumb meets a curved arc of fingertips).
- Distance from thumb tip to each finger's PIP and MCP — catches T, M, N.
- Signed distance of the thumb tip along the palm normal w, relative to the plane of the curled fingers. This is your single most important feature. It answers "is the thumb beside the fist, or in front of it?" — which is exactly the A-versus-S distinction.
- Lateral (v-axis) position of the thumb tip relative to the MCP row — answers "how far across the fist has the thumb traveled?", which is the M-versus-N distinction.

### 4.4 Orientation features (world frame)

Two things, both taken in world coordinates before rotation:

- **Pointing direction:** where the extended fingers point, expressed as the world-frame direction of u. K points up; P is the same handshape pointed down. G points sideways; Q points down.
- **Palm facing:** the world-frame direction of w. Whether the palm faces the signer or the camera is part of the correct form for several numbers and letters.

These features must not be rotation-normalized — that's the entire point. Keep them in a separate part of the feature vector so you never accidentally normalize them away.

## 5. Recognition engine

### 5.1 Constraint primitive

A constraint is a plain data object:

```js
{
  id:       "thumb-beside-not-across",
  feature:  "thumbSignedNormal",
  lo:       -0.08,
  hi:        0.08,
  tol:       0.12,
  weight:    3,
  critical:  true,
  fail:      "Your thumb should rest flat against the side of your index finger, not wrap across the front of your fingers.",
  hint:      "Think of it like a fist with the thumb riding alongside."
}
```

Satisfaction is a trapezoidal membership function — full credit inside the target band, decaying linearly across the tolerance zone:

```js
function satisfy(x, lo, hi, tol) {
  if (x >= lo && x <= hi) return 1;
  const d = x < lo ? lo - x : x - hi;
  return Math.max(0, 1 - d / tol);
}
```

Soft scoring matters. Binary pass/fail produces a jittery app and useless feedback; a continuous score lets you say "you're close" and lets you rank near-misses.

### 5.2 Letter scoring

Use a weighted geometric mean, clamping each satisfaction to a small floor so one zero doesn't annihilate the whole product:

```
score(letter) = exp( Σ wᵢ · ln(max(sᵢ, 0.01)) / Σ wᵢ )
```

Geometric mean is the right choice over arithmetic mean because it punishes a single badly-failing constraint much harder. A handshape that's perfect except the thumb is in entirely the wrong place is not a 90% correct A — it's a different letter.

Then gate acceptance on two conditions, not one:

1. score ≥ ACCEPT_THRESHOLD (start around 0.75, tune empirically)
2. every constraint marked critical has sᵢ ≥ 0.5

The second condition prevents a high average from papering over a disqualifying error.

### 5.3 Classification and tie-breaking

Score every letter in the active candidate set (alphabet mode or number mode — never both), then sort.

If the top two scores are within a margin (~0.08), don't just pick one. Run a dedicated tie-breaker: a small table mapping confusable pairs to the single most discriminative feature for that pair.

```
("M","N") → thumb lateral position vs. ring MCP
("A","S") → thumb signed normal distance
("U","V") → index/middle spread angle
("K","P") → world-frame pointing direction
```

And surface the ambiguity to the user, because it's pedagogically valuable: "I'm reading this as somewhere between M and N — check how many fingers are covering your thumb." That message is more useful than a confident wrong guess, and it's a great thing to show a judge.

### 5.4 Feedback generation

In practice mode the target letter is known, so:

1. Score the target letter's constraints against the current frame.
2. Rank failures by weight × (1 − satisfaction).
3. Surface the top one. One correction at a time — a list of five simultaneous complaints is how you make a learner quit.

When that constraint clears, the next-worst surfaces automatically. The learner experiences this as being guided step by step, which is exactly what a human tutor does.

Rate-limit the message: hold each correction on screen for a minimum of ~1.5s regardless of what the frames say, or the text strobes unreadably.

### 5.5 Example constraint sets

Concrete enough to code from, but verify every handshape against an authoritative source before you encode it — Gallaudet, or Bill Vicars' Lifeprint/ASL University. Do not trust memory, mine or yours. Handshape descriptions from AI systems and from casual web sources are frequently subtly wrong, and subtly wrong is exactly what your app is supposed to prevent.

| Letter | Defining constraints |
|--------|----------------------|
| A | All four fingers curled (curl > 0.85). Thumb extended alongside the fist. Thumb signed-normal ≈ 0 (beside, not in front). |
| S | All four fingers curled. Thumb signed-normal clearly positive (crossing in front), thumb tip positioned over index/middle PIP. |
| T | Fingers curled. Thumb tip inserted between index and middle — lateral position between their MCPs, signed-normal positive. |
| N | Fingers curled over thumb; thumb tip lateral position near the middle-finger MCP (two fingers covering). |
| M | Same, but thumb tip lateral position near the ring-finger MCP (three fingers covering). |
| E | Fingers curled with fingertips low and touching the thumb, which is tucked horizontally beneath them. |
| U | Index + middle extended, ring + pinky curled, thumb across them. Spread angle < ~10°. |
| V | Identical, spread angle > ~20°. |
| R | Index + middle extended and crossed — lateral sign flip test (§4.3). |
| K | Index + middle extended and spread, thumb between them at middle PIP. Fingers point up in world frame. |
| P | Identical shape, fingers point down. |
| F | Thumb tip touches index tip (small distance); middle, ring, pinky extended. |
| O | All fingertips curve to meet the thumb, forming a closed circle. |
| D | Index extended; thumb tip contacts middle fingertip; remaining fingers curled to meet it. |
| L | Index extended up, thumb extended out roughly perpendicular, others curled. |

Note that 9 is the same handshape as F, and 6 is the same as W. Mode separation (§5.3) is what makes this tractable.

## 6. Temporal layer

### 6.1 Stability gate

Maintain a ring buffer of the last 10–15 frames (roughly half a second at 30fps).

Only commit a classification when both conditions hold:

1. Landmark positions have low variance across the buffer (the hand is being held still, not moving through a transition).
2. The top-ranked letter has been consistent for K consecutive frames.

Without this, you grade the garbage geometry that exists mid-transition between two letters, and the UI flickers unusably.

### 6.2 Hysteresis

Use asymmetric thresholds: enter the "correct" state at score ≥ 0.80, but don't leave it until score < 0.65. A single threshold means the display strobes whenever the learner sits right at the boundary — which is precisely where a learner who is almost correct will sit.

### 6.3 J and Z

These need trajectory matching, not handshape matching.

**Structure:** detect that the base handshape is held (I for J, index-point for Z), then record the relevant fingertip's position in the palm-normalized frame over a ~1 second window.

**Matching:** resample the recorded path to a fixed number of points (say 32), scale-and-translation normalize it, then compare against a hand-authored template by summed point-to-point distance. This is the core of the $1 Unistroke Recognizer — a well-documented, genuinely simple algorithm that is far easier to explain to a judge than DTW while performing comparably on this task. Cite the paper (Wobbrock, Wilson & Li, 2007) in your documentation.

**Fallback:** if $1 proves finicky, a stroke-direction signature works too. Z is three strokes — right, diagonal down-left, right. Quantize the path into direction segments and pattern-match the sequence. Less elegant, more robust, easier to debug.

## 7. Module structure

```
src/
  vision/
    camera.js        getUserMedia, video element, mirror + resolution handling
    landmarker.js    MediaPipe init, per-frame detect, returns raw landmarks
  geometry/
    vec3.js          dot, cross, norm, angle, EMA helpers
    plane.js         3×3 PCA / eigendecomposition for palm plane fit
    normalize.js     handedness mirror, translate, scale, rotate to palm frame
    features.js      curl, spread, crossing, thumb metrics, orientation
  recognition/
    constraints.js   constraint primitive + satisfy() membership functions
    letters/         one module per letter (or per handshape family)
    numbers/
    classifier.js    scoring, ranking, tie-breakers, candidate-set modes
    temporal.js      ring buffer, stability gate, hysteresis
    motion.js        $1 recognizer for J and Z
  curriculum/
    lessons.js       ordering, prerequisites, handshape families
    feedback.js      failure ranking, message selection, rate limiting
  progress/
    store.js         localStorage persistence, mastery model
  ui/
    overlay.js       canvas skeleton rendering
    views/           learn, practice, quiz, progress
    debug.js         live feature inspector  ← build this first
  main.js
```

### The debug panel is the highest-leverage thing you will build

Before you write a single letter constraint, build ui/debug.js: a live panel that displays every computed feature value in real time as you move your hand. Curl values, spread angles, thumb distances, orientation vectors, all updating at 30fps.

You will use it constantly. It is how you discover that your curl metric saturates too early, that your palm normal flips sign when the hand tilts past 60°, and — most importantly — what the actual numeric range of "thumb beside the fist" is on a real hand. You cannot guess these thresholds. You have to watch them.

## 8. Calibration and testing

### Capture tool

Build a small internal page that records the full feature vector to JSON while a teammate holds a given letter. Run it across every team member and every letter, maybe 30 samples each.

Then plot the distributions. For each constraint you're considering, look at where the target letter's samples cluster versus where its confusable neighbors cluster, and set lo/hi/tol from the data rather than from intuition. If two letters' distributions overlap on a feature, that feature is not a discriminator — find a different one.

This is real empirical engineering, it's entirely your own data, and it's a strong process artifact to show judges.

### Regression suite

Save landmark JSON fixtures with expected labels — aim for 150–300 cases spanning every letter, multiple hands, multiple lighting conditions, and deliberate near-misses. Run them on every commit.

This is what lets you refactor the closed-fist family in week 9 without silently breaking the letters you finished in week 4. "We have a 200-case automated test suite" is also a sentence that lands well with judges.

## 9. Curriculum design

Don't teach A through Z alphabetically. Teach by handshape family, and teach contrastively.

Rough grouping:

- Closed fist: A, S, T, M, N, E
- Single extended finger: D, G, I, Z
- Two extended fingers: U, V, R, K, P
- Three: W, F
- Flat/open: B, C, O
- Distinctive outliers: L, Y, X, H, J, Q

Within each family, introduce a letter, then introduce its nearest confusable neighbor, then explicitly drill discrimination between them — alternate A, S, A, S and require the learner to switch cleanly. This is discrimination training, a well-established principle in motor-skill acquisition, and it directly targets the fossilization problem in your premise. It's also a design decision you can justify from literature, which is exactly the kind of thing that separates a first-place project from a fourth-place one.

### Mastery model

Track per-letter mastery rather than a raw counter. A simple approach: mastery increments on a clean first-attempt success, decrements on failure, and requires N successes spaced across separate sessions to reach "mastered." Letters that repeatedly fail get flagged as leeches and resurface more often. Persist to localStorage.

## 10. Accessibility

Take this seriously — it's both rubric points and the right thing to do in an app about a signed language.

- Never gate progress on camera access. Learn mode must be fully usable with the camera off. Some users won't have one, some won't be able to use one, and some judges' laptops will refuse permission at the worst moment.
- Don't encode feedback in color alone. Pair every red/green state with an icon and a text label.
- Full keyboard navigation, with visible focus states. Hand-tracking apps have a bad habit of assuming mouse-only.
- Captions on every instructional video, non-negotiable in this domain.
- A tolerance slider. Let users widen constraint tolerances for limited hand mobility, arthritis, or partial hand differences. This is a genuinely thoughtful feature and I'd put it on a slide.
- High-contrast mode and respect for prefers-reduced-motion.

## 11. Positioning and ethics

One slide, early in your presentation, that says roughly:

> Fingerspelling is a small part of ASL. ASL is a complete natural language with its own grammar and syntax — it is not English rendered on the hands. SignSense is a practice tool for one mechanical skill, not a path to fluency, and it is not a substitute for learning from Deaf instructors and the Deaf community.

This costs you thirty seconds and buys you enormous credibility. The failure mode for a hearing student team building an ASL app is coming across as though you think you've solved something you haven't. Naming the limitation yourself preempts the question entirely and demonstrates the kind of maturity judges reward.

Related: if you can get a local ASL instructor or a Deaf community member to review your handshape definitions and give you a quote, do it. That single piece of evidence outweighs a lot of polish.

## 12. Build order

Sequenced so that every phase produces something demonstrable and the hard parts have room to slip.

| Phase | Deliverable |
|-------|-------------|
| 0 | Camera + landmarker + skeleton overlay. Verify sustained 30fps on the weakest laptop your team owns. |
| 1 | Geometry layer + live debug feature inspector. |
| 2 | Capture tool; collect feature data across the team for all 24 static letters. |
| 3 | Constraint engine + five visually distinct letters (A, B, C, D, L). Validates the whole pipeline end to end. |
| 4 | Remaining static letters. Closed-fist family last — it's the hardest and you want maximum tooling maturity by then. |
| 5 | Temporal layer: stability gate, hysteresis, smoothing. |
| 6 | J and Z motion recognition. |
| 7 | Numbers 1–9 + mode separation. |
| 8 | Curriculum, learn mode, practice mode, quiz, scoring, progress persistence. |
| 9 | Accessibility pass, offline bundling verification, visual polish. |
| 10 | User testing with real ASL learners. Regression suite. Documentation and design journal. |

Two scheduling notes. Phase 4 will take longer than you think — the thumb-occlusion problem is genuinely hard and no amount of clever code fully eliminates it. And phase 10 is not optional padding: user testing evidence and process documentation are frequently where projects with comparable code quality separate from each other in scoring.

## 13. Risk register

| Risk | Mitigation |
|------|------------|
| Closed-fist family unreliable due to thumb occlusion | Consider requiring a slight hand rotation for that family, cue it in the UI, and accept a wider tolerance. Document the limitation honestly rather than hiding it. |
| Poor lighting at the venue kills detection | Test under bad lighting deliberately. Add a live "detection quality" indicator so the user knows it's the lighting, not them. Bring a small clip-on light to the demo. |
| Judge's hand is much larger or smaller than the team's | Scale normalization (§4.2) should handle it, but verify against an adult hand and a child-sized hand before the event. |
| Laptop GPU delegate unavailable | Implement CPU delegate fallback and test it. Know your CPU-only framerate. |
| Camera permission denied on demo machine | Learn mode works camera-free (§10). Have a pre-recorded fallback video, but lead with live. |
| Offline claim fails at the venue | Verify in airplane mode, repeatedly, from a clean browser profile with cache disabled. |

## Appendix A — Phase 0 exit criteria

1. **Vite scaffold** — module structure stubbed. Done when: `npm run dev` serves.
2. **Camera** — getUserMedia, video element, mirrored preview. Done when: denying permission shows a friendly message instead of a console error.
3. **Landmarker init** — tasks-vision, GPU delegate, `numHands: 1`, WASM and .task copied into public/. Done when: no network requests to any CDN on load.
4. **Detection loop** — requestVideoFrameCallback, monotonic timestamps into detectForVideo. Done when: frame timestamps are strictly increasing with no duplicates.
5. **Overlay** — draw 21 points plus the connection edges on a canvas layered over the video. Done when: the skeleton tracks your hand with no visible offset at two different window sizes.
6. **FPS counter** — rolling average, on screen. Done when: you know your number on the weakest laptop on the team.
7. **Offline check** — airplane mode, clean browser profile, cache disabled. Done when: it works.
