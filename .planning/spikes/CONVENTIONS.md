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

## Tools & Libraries

- `esbuild` from the root `node_modules` (bundle the probe, `--format=iife`).
- Headless Chrome (system install) with `--dump-dom`.
- No test framework needed for pixel gates; vitest only where the app/package suites are
  the evidence (`npx vitest run`, never watch).
