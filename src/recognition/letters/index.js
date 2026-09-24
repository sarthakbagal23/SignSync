// The alphabet candidate set (design §5.3): classify against this list —
// never mix in numbers. Phase 3 ships the five visually distinct letters
// that validate the pipeline (§12); the rest land in Phase 4, closed-fist
// family last.

import { A } from "./a.js";
import { B } from "./b.js";
import { C } from "./c.js";
import { D } from "./d.js";
import { L } from "./l.js";

export const ALPHABET = [A, B, C, D, L];
