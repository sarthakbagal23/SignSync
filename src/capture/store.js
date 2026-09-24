// Capture sample store (design §8): in-memory samples persisted to
// localStorage, rounded to 4 decimals to keep the payload compact (that is
// already far below landmark noise). Export builds the versioned JSON
// envelope used for threshold calibration and regression fixtures.

const KEY = "signsync.capture.v1";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const TARGET_PER_LETTER = 30;

// Deep round: numbers → 4 decimal places; arrays/objects recursed;
// everything else passes through untouched.
export function roundDeep(value, places = 4) {
  const m = 10 ** places;
  if (typeof value === "number") return Math.round(value * m) / m;
  if (Array.isArray(value)) return value.map((v) => roundDeep(v, places));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = roundDeep(v, places);
    return out;
  }
  return value;
}

const defaultStorage = () =>
  typeof localStorage !== "undefined" ? localStorage : null;

export function createStore({ storage = defaultStorage() } = {}) {
  let samples = [];
  let persistFailed = false;

  const persist = () => {
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify(samples));
      persistFailed = false;
    } catch {
      // Quota exceeded (or storage disabled): keep the memory copy usable
      // and flag it so the UI can tell the user to download their data.
      persistFailed = true;
    }
  };

  try {
    const raw = storage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) samples = parsed;
  } catch {
    samples = []; // corrupted storage → start fresh rather than crash
  }

  const count = (letter) =>
    samples.reduce((n, s) => n + (s.letter === letter ? 1 : 0), 0);

  return {
    // data: { t, label, scale, landmarks, features } — stored rounded.
    add(letter, data) {
      if (!LETTERS.includes(letter)) {
        throw new Error(`Invalid letter for capture: ${JSON.stringify(letter)}`);
      }
      const stored = { letter, ...roundDeep(data) };
      samples.push(stored);
      persist();
      return stored;
    },

    count,
    remaining: (letter) => Math.max(0, TARGET_PER_LETTER - count(letter)),
    counts: () => Object.fromEntries(LETTERS.map((L) => [L, count(L)])),
    all: () => [...samples],

    clear() {
      samples = [];
      persist();
    },

    exportPayload: () => ({
      meta: {
        app: "SignSync",
        version: 1,
        exported: new Date().toISOString(),
        targetPerLetter: TARGET_PER_LETTER,
        hand: "canonical right (mirrored from MediaPipe label)",
      },
      samples: [...samples],
    }),

    get persistFailed() {
      return persistFailed;
    },
  };
}
