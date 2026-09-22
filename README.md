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
