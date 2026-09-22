import { defineConfig } from "vite";

// GitHub Pages serves this repo as a *project site* at
// https://<user>.github.io/SignSync/ — so built asset URLs must be prefixed
// with the repo name. `base` does exactly that; dev (`npm run dev`) still
// serves from `/` unaffected.
export default defineConfig({
  base: "/SignSync/",
  // main.js uses top-level await — needs a target that supports it (ES2022+).
  build: { target: "esnext" },
});
