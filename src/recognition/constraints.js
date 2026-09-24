// Constraint primitive (design §5.1): a plain data object naming a feature
// path, a target band [lo, hi], a linear tolerance zone, a weight, and
// optional criticality + coaching text. Satisfaction is a trapezoidal
// membership function — full credit inside the band, decaying linearly
// across the tolerance, 0 beyond. Soft scoring on purpose: binary pass/fail
// produces a jittery app and useless feedback.

export function satisfy(x, lo, hi, tol) {
  if (x >= lo && x <= hi) return 1;
  const d = x < lo ? lo - x : x - hi;
  if (tol <= 0) return 0; // zero tolerance = hard binary membership
  return Math.max(0, 1 - d / tol);
}

// Resolve a dotted feature path against the feature vector, with optional
// array indexing: "thumb.tipDist.index", "orientation.pointing[1]".
// Unknown paths throw — a typo in a constraint must never silently read 0.
export function resolveFeature(features, path) {
  let value = features;
  for (const segment of path.split(".")) {
    const indexed = segment.match(/^(.+)\[(\d+)\]$/);
    if (indexed) {
      const [_, key, i] = indexed;
      if (value == null || !Array.isArray(value[key])) {
        throw new Error(`Feature path "${path}" indexes a non-array at "${key}"`);
      }
      value = value[key][Number(i)];
    } else {
      if (value == null || typeof value !== "object") {
        throw new Error(`Feature path "${path}" hits a non-object at "${segment}"`);
      }
      value = value[segment];
    }
    if (value === undefined) {
      throw new Error(`Unknown feature path: "${path}"`);
    }
  }
  return value;
}

// Validate a letter definition at load/test time — catches malformed bands,
// bad weights, and non-string feature paths before they score anything.
export function validateDef(def) {
  if (!def || typeof def.letter !== "string" || !/^[A-Z]$/.test(def.letter)) {
    throw new Error(`Bad letter definition: expected a single letter, got ${JSON.stringify(def?.letter)}`);
  }
  if (!Array.isArray(def.constraints) || def.constraints.length === 0) {
    throw new Error(`Letter ${def.letter}: constraints must be a non-empty array`);
  }
  for (const c of def.constraints) {
    const where = `${def.letter}/${c.id ?? "?"}`;
    if (typeof c.feature !== "string" || c.feature === "") {
      throw new Error(`${where}: feature must be a non-empty string`);
    }
    for (const key of ["lo", "hi", "tol", "weight"]) {
      if (typeof c[key] !== "number" || !Number.isFinite(c[key])) {
        throw new Error(`${where}: ${key} must be a finite number`);
      }
    }
    if (c.hi < c.lo) throw new Error(`${where}: hi (${c.hi}) < lo (${c.lo})`);
    if (c.tol < 0) throw new Error(`${where}: tol must be ≥ 0`);
    if (c.weight <= 0) throw new Error(`${where}: weight must be > 0`);
    if (c.critical !== undefined && typeof c.critical !== "boolean") {
      throw new Error(`${where}: critical must be boolean`);
    }
    for (const key of ["fail", "hint"]) {
      if (c[key] !== undefined && typeof c[key] !== "string") {
        throw new Error(`${where}: ${key} must be a string`);
      }
    }
  }
}
