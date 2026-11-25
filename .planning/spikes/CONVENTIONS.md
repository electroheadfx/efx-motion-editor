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
- **Measure a serialized path as ONE draw after an idle GPU — and run a size ladder.** A
  throughput loop (N queued draws ÷ N) hides latency behind pipeline overlap and cannot
  tell a per-draw floor from fragment work; a 1×1 / 512² / 1024² / full ladder can
  (spike 006 Q3b: 0.5 / 0.6 / 17.5 / 31.9 ms — the cost was the stroke's band texels, not
  the draw). When the gate is "what the artist feels", submit the operation,
  `gl.flush()`, wait the artist's pause, then fence: that is the only sequence that
  answers it, and the derived `work − pause` should agree with the measurement.
- **Reduce the equations, not the parameters — and judge through all of them.** A per-texel
  solve with N unknowns needs N well-conditioned equations, not every band the display
  samples. Spike 006 Q3c: fitting the 8 D-optimal bands (maximising the weighted `log det`
  of the sensitivity Gram over all 12,870 subsets) and **re-rendering through all 16** met
  the acceptance bar exactly (max 2/255, p95 ≤ 1, 0 texels over of 1.45 M) and halved the
  merge cost (30.3 → 19.1 ms). The fit's band list must never enter the acceptance check;
  pick it on a property of the display basis (state-independent, reproducible), not on the
  scene.
- **Compile design constants into the shader; keep uniforms for scene parameters.** A
  reduced band LIST only shrinks the arrays (`tgt`, `r0`, `J`, the normal equations) when
  it is a compile-time constant — a uniform mask skips work but leaves the state at 16.
  Spike 006 Q3c also measured the converse: the seed law as a `uniform bool` cost
  +1.6–2.0 ms and exactly the same as a `const`, so that one was algorithmic (rejected LM
  attempts), not codegen. Measure before attributing a delta to either.
- **The GPU pays for the slowest lane, not the mean.** Iteration counts read back from the
  merge showed a mean of 1.7 accepted steps, yet the pass cost what 4 iterations cost:
  within a wavefront every lane runs until the last one stops. Budget
  `iterations × rect`, never `mean(iterations) × rect`.
- **When the gate is inside the run-to-run drift, interleave the contenders.** A ~1 ms bar
  against ±10 % drift cannot be resolved by a table of sequentially measured candidates
  (spike 006 Q3c: the same shader read 21.0 ms mid-run and 23.6 ms at the end of one run,
  20.5–21.0 in another). Alternate A and B in one process, 3–4 rounds each, and compare the
  medians — a linear drift then applies to both.
- **Do not decimate a per-texel solve of a nonlinear law over textured inputs.** A
  half-resolution fit plus an upsample is only valid if the fitted quantity is smooth in
  the *output* space. Spike 006 Q3b: the band's target is a pointwise mix of two
  full-resolution textured states, so a half-res fit was 11.9 ms and **216/255** wrong
  while the exact-copy branches (core and outside) were provably perfect — a cheap
  variant that fails the law, not the code.
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

- **A replay is only "the same script" from the same starting state — name it.** Spike
  006 Q4: the engine carries the previous stroke's end direction/tip angle into the next
  stroke's first dab (`scriptBegin` seeds from `lastDir`/`lastAngle`; `resetSheet` clears
  neither), so an in-process replay after a reset inherits a different start and paints
  differently. It is deterministic, not nondeterminism — pinning the carry to the
  constructor's `[1,0]/0` reproduced the first paint byte for byte, and two fresh
  processes produced identical full-capture digests. Log each run's start state; a parity
  bar that does not name its starting state cannot be reproduced.
- **Byte-identity of a capture is not byte-identity of a sheet.** A capture is cropped to
  the engine's `everPainted` bbox, which drifts a few texels between runs while the paint
  is identical; and a layer that is not zero outside the crop (a sentinel-stamped
  timestamp) reads as different if you zero-fill. Compare the rendered display or the
  union of the crops, and judge the layers the feature actually owns.
- **Separate what the harness can prove from what only the implementation can.** A probe
  can prove that a pass is a pure deterministic function of its inputs, that its output
  survives capture/restore, and that a script replays; it cannot prove that the engine
  *calls* it at the right lifecycle point (pointer vs scripted stroke end, bake replay).
  Write those as named gate rows in the findings — a "deferred" line with no rows is a
  silent gap.

## Tools & Libraries

- `esbuild` from the root `node_modules` (bundle the probe, `--format=iife`).
- Headless Chrome (system install) with `--dump-dom`.
- No test framework needed for pixel gates; vitest only where the app/package suites are
  the evidence (`npx vitest run`, never watch).
