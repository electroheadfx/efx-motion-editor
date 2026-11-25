# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these
unless the question requires otherwise.

## Stack

- **Pixel truth comes from the real engine, never a mock.** The engine spike harness runs
  the vendored `WatercolorEngine` through the real `createAquarelleEngineAdapter` in real
  WebGL2 (headless Chrome), exactly like the committed `probe/medium-engine` gate. A CPU
  re-implementation of a shader law is not evidence.
- **Headless Chrome, one engine per process.** No dev server (the user runs the app).
  `--headless=new --enable-unsafe-swiftshader --allow-file-access-from-files --dump-dom`,
  result JSON in a `<pre id="result">`, driver parses the DOM.
- **Seeded determinism.** Replace `Math.random` for the constructor's paper seed
  (`0xc0ffee`), fix the paper, the paper strength, the script and the mutation ids. Every
  capture must be reproducible byte for byte. Add a **negative control** for each seed you
  believe is load-bearing (an unrecorded RNG offset, an unpinned paper seed): if varying
  the seed does not change the output, the record does not need it — and if it does, that
  is the field the plan must pin.

## Structure

```
.planning/spikes/NNN-name/
  README.md            frontmatter + Research + How to Run + Results + Limitations
  VERDICT.md           the decision document (numbers + go/no-go) when the spike answers one
  workbench/           a THROWAWAY copy of the code under experiment (never the main tree)
    node_modules/@efxlab/* -> repo workspace packages (so the copy resolves them)
  probe/               probe.ts (scenario + instrumentation) + index.html + run.mjs
  results/             one JSON per gate (digests, regions, timings, draw/memory counters)
```

`probe/probe.bundle.js` is an esbuild artifact (~500 KB) — regenerate it, never commit it.
When wrapping a spike up, preserve the **patch against the base commit**, not the whole
workbench copy: the copy goes stale the moment the main tree moves, and a stale whole file
reads as current code.

## Patterns

- **Copy, never edit in place.** A model experiment copies the source tree into
  `workbench/` (1.1 MB here) and patches the copy. The main tree stays clean; the copy is
  disposable.
- **Instrument at the GL boundary.** Patch `GL.prototype.target` / `disposeTarget` /
  `draw` / `blit` on **each** engine class to count GPU target bytes and full-document
  passes. Measure, do not infer cost from code reading. Reset the peak counter at script
  start, or setup scratch (paper fields) is attributed to the feature under test.
- **One engine per page for cost, two for determinism.** Two live engines in one page is
  the right shape for a replay-equality gate (same process, direct digest comparison) and
  the wrong shape for a timing gate: at 2K the second run degraded ~35 % under SwiftShader
  memory pressure. Timing gates run one engine per process, exactly like
  `probe/medium-engine`.
- **Prove neutrality first.** Run the committed `neutral-identity` script (and a Body-0
  stroke script) on both engines and require byte-identical digests before trusting any
  differing number.
- **Compare against the current build in the same harness**, not against a remembered
  number: `--engine baseline` imports the main tree read-only, `--engine coverage` the
  copy, same scripts and seeds.
- **Boxes live inside stroke cores.** Stroke alpha rims are ~0.02 doc heights wide; a box
  that spans a rim averages paint with paper and invents "paper-white" failures.
- **Read per-dab terms, not the final metric.** When a deposit-chain law misbehaves,
  instrument the pass on the real engine — a prototype tap on the pass's per-dab uniforms
  and pre-dab fields plus `readBristles()` — and pin the exact bristle indices
  (`--centre/--rim`). A final hue/pixel metric cannot name the collapsed term (spikes
  002/003: the pickup collapse was one uniform on the first dab; wet, touch and thirst
  were identical).
- **Separate the knob from the scene.** When a control is under test, the underlayer is
  painted neutral (Body 0) and only the stroke under test carries the knob.
- **Per-dab readouts come from a prototype tap, not a re-implementation.** Wrap the
  private per-dab method (`bristleTravel`, `carrierPass`) on `WatercolorEngine.prototype`
  and capture the arguments it is called with; read `readBristles()` and the GPU fields at
  the *start* of dab N+1 to see the state *after* dab N. Reset the counter in
  `beginBristles` (one call per stroke). Recompute a shader term on the CPU only from
  those recorded arguments, with the GLSL twin transcribed (e.g. `noise1`/`hash21`), and
  pin bristle indices across builds (`--centre/--rim`) — a field-dependent pick can
  otherwise select different bristles per build.
- **Earn a CPU mirror of a shader law; then use it.** When a measurement needs the display
  law over hundreds of thousands of states, a CPU mirror is the only affordable route —
  but it is evidence only after a **mirror gate**: upload a grid of independent random
  states into the real engine, export them through the real shader, and require the
  mirror to reproduce the export within 1/255 (spike 006: 291,600 states, 55 % in the
  Kubelka-Munk branch, max 1/255). Keep a second, end-to-end check on a real scene, and
  report both. The old rule still holds for a *substitute*: a mirror that has not passed
  its gate is not evidence.
- **Sweep a law over its own independent variable, not over the scene.** A composite
  parameterised by an alpha should be measured by sweeping alpha over real sampled
  states (spike 006: stations `t` of `A = 1 − amount·t^e`); geometry then only *selects*
  texels. Tying the sweep to a stroke's pixel geometry entangles the law with the drive
  and produces station noise that has nothing to do with the law.
- **Read geometry off the capture, never off the authored coordinates.** A stroke's
  authored points do not survive the adapter's drive — spike 006 asked for
  `x 25…230` on a 256 sheet and the engine placed the ink at `x 0…177`. Derive the
  centreline, the silhouette and the under-stroke's rows from the captured ink.
- **Judge a law in the space it lives in.** Alpha compositing is linear-light; sRGB
  "darkness" (`1 − min(rgb)`) is companded and does **not** halve under a 50 % linear
  mix (spike 006: a correct law reads 0.255 where a naive check expects 0.413). State the
  space in the acceptance criterion, and disqualify hue comparisons on near-grey
  composites — hue is ill-conditioned there, so qualify it by chroma.

## Tools & Libraries

- `esbuild` from the root `node_modules` (bundle the probe, `--format=iife`).
- Headless Chrome (system install) with `--dump-dom`.
- No test framework needed for pixel gates; vitest only where the app/package suites are
  the evidence (`npx vitest run`, never watch).
