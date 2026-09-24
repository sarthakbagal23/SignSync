import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// GitHub Pages serves this repo as a *project site* at
// https://<user>.github.io/SignSync/ — so built asset URLs must be prefixed
// with the repo name. `base` does exactly that; dev (`npm run dev`) still
// serves from `/` unaffected.
export default defineConfig({
  base: "/SignSync/",
  build: {
    // main.js / capture.js use top-level await — ES2022+ target required.
    target: "esnext",
    // Multi-page: the main app and the internal capture tool (design §8)
    // are separate entries so the coaching app never loads capture code.
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        capture: resolve(root, "capture.html"),
      },
    },
  },
});
