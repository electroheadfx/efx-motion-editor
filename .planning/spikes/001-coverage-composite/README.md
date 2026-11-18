---
spike: 001
idea: opaque-acrylic-coverage
name: coverage-composite-acrylic
type: standard
validates: "Given a per-dab coverage term composited source-over inside the pigment layer, when white 240 is painted over saturated blue at Body 100/60/30 and red over blue for 50 rapid strokes at 1080², then the underlayer is hidden at 100 and partly at 60 with no paper-white and no black drift, at lower per-stroke cost than the rev-4 punch path"
verdict: VALIDATED
related: []
tags: [webgl2, watercolor, acrylic, coverage, performance, punch-machinery]
---

# Spike 001: Coverage-composite acrylic (no punch machinery)

## What This Validates

Replace the rev-4 order — *erase the underlayer along the brush footprint, then deposit
watercolor* — with a **per-dab coverage term composited source-over inside the pigment
layer**, and check three measurable criteria at 1080×1080:

1. White `#f0f0f0` (240) over saturated blue `#0044dd` at Body 100 / 60 / 30: at 100 the
   underlayer disappears; at 60 it is partly visible; no value produces paper-white.
2. Red `#cc2222` over blue, 50 rapid strokes: no drift toward black; hue within tolerance.
3. 50 rapid strokes: no per-stroke full-canvas punch/merge; p95 stroke latency and memory
   against the current build.

The question was allowed to answer **no**. It answered **yes** — on the engine side.

## Research

The engine stores seven absorbance coefficients + a scattering scalar per texel
(`ink` mobile and `fixed` settled, both 2 × RGBA16F). Every stroke's paint sums into the
same buffers, which is *why* the rev-4 cover erases: the underlayer and the new stroke
are indistinguishable once deposited. The rev-4 path pays, per cover stroke:

- a stroke-start full-document `preInk` snapshot (2 × RGBA16F = 16 B/texel = 17.8 MiB at
  1080², allocated + blitted per stroke),
- a **full-document ping-pong** per dab (`inkCover` read-modify-write + the `preInk`
  decay, 2 full-document draws per dab),
- an app-level punch of the cached base per stroke (visible + durable), a per-frame
  preview punch, and a commit merge (`PhysicsPaintStudio.tsx:8470`, `:8510`;
  `aquarelleLiftErase.ts` `punchTransmittanceBytes`).

The display's mode-4 alpha is `1 − min(r,g,b)` — a *darkness* alpha. A near-white pigment's
alpha is ~0.02–0.18, so white can never hide what is beneath it; that is the structural
reason "near-white does not cover", not a tuning miss.

**Chosen approach** (implemented in `workbench/`, a copy of `packages/efx-watercolor/src`
with the model in place; the main tree is untouched):

- **Pigment-independent coverage.** Per dab,
  `a = coverAmount · (1 − exp(−K · amount · m))`, where `m` is the deposit's own footprint
  mask (same tip texture, rotation, jitter and paper tooth as the stamp), `coverAmount =
  min(1, bodyCurve(Body) · 2)` (the approved D-14 curve and gain), and `K = 8` is the
  medium's per-dab optical density — derived from the paint volume, **never** from the
  pigment's absorbance. This is what lets white cover.
- **Source-over in coefficient space.** Three scissored draws per dab:
  `ink ← ink·(1−a) + C·a` (C = the dab's masstone absorbance), `fixed ← fixed·(1−a)`,
  `coverage ← coverage·(1−a) + a`; scattering `S ← S·(1−a) + S_dab`.
- **Coverage-aware display.** Mode 4: `alpha = max(1 − min(r,g,b), coverage)`,
  `color = (t − (1 − alpha)) / alpha` (reduces to the existing formula when
  `alpha = 1 − min`). The live sheet can now hide the cached base by compositing, with no
  punch.
- **Removed:** the `preInk` snapshot, the `inkCover` ping-pong and the `onCoverDab`
  punch callback. Body 0 keeps the additive path, byte-for-byte.

## How to Run

```bash
# full matrix (12 gates: baseline vs coverage × criteria)
node .planning/spikes/001-coverage-composite/probe/run.mjs --matrix

# one gate
node .planning/spikes/001-coverage-composite/probe/run.mjs \
  --gate white-over-blue-coverage-b100 --engine coverage \
  --scenario white-over-blue --size 1080 --body 100
```

Engines: `--engine baseline` imports `packages/efx-watercolor/src` read-only;
`--engine coverage` imports the patched copy in `workbench/src`. One engine per headless
Chrome process; seeded RNG (`0xc0ffee`), cold paper, paper strength 1. Results land in
`results/<gate>.json`.

No dev server, no commits. The main tree was never modified.

## What to Expect

`--matrix` runs 12 gates in ~20 s. Each gate prints bake ms, p95, full-document draw count
and peak transient memory; the JSON carries the region statistics, per-stroke timings,
digests, draw/blit counts and tracked GPU target bytes.

## Observability

The probe instruments the GL layer directly, for **both** engines:

- `GL.target` / `disposeTarget` — GPU target bytes allocated, disposed, live, peak.
- `GL.draw` — total vs full-document draws (no scissor, document-sized target).
- `GL.blit` — full-document blits (the rev-4 `preInk` snapshot is 2 per stroke).

## Results

See `VERDICT.md` for the full table. Summary:

- **Criterion 1 — PASS (coverage), FAIL (baseline).** At Body 100 the crossing reads
  241/242/242 with 0.7 blue excess (the untouched band reads 41.1): the underlayer is gone.
  At Body 60 the blue excess is 31.2 (76 % of the underlayer's) — partly visible. At Body 30
  the underlayer is intact. Whole-sheet "covered but paper-white" texels: **0 %** at every
  Body. The baseline stays blue-tinted at *every* Body (35.8–40.0); its white paint reads
  251 with an own-area layer alpha of 0.02 (0.18 at the crossing) — near-white never covers.
- **Criterion 2 — PASS (coverage), FAIL (baseline).** 50 rapid red strokes over blue:
  coverage final luma is 0.982 of its own fresh-red reference and Δhue −0.1°; the baseline
  is 0.835 of its reference (16.5 % darker — the blue still sums in). Stated tolerance:
  luma ratio ≥ 0.95, |Δhue| ≤ 3°.
- **Criterion 3 — PASS (coverage).** 54 strokes at 1080²: coverage **0** full-document
  draws and **0** transient bytes above setup; baseline **3613** full-document draws,
  **105** full-document blits and **+17.80 MiB** per-stroke transient (`preInk`). Median
  rapid stroke **5.8 ms vs 23.8 ms** (4.1×); total bake **1170 ms vs 1389 ms** (−16 %;
  the shared fluid sim/settle dominates the rest). Raw p95 is higher for coverage
  (135 ms vs 56.5 ms), but the Body-0 control — same script, cover path off, engines
  byte-identical — shows **100.8 vs 110.3 ms p95 on both engines**, and the baseline's own
  Body-0 p95 exceeds its Body-100 value: the tail is a periodic shared sim/readback stall
  landing on different frames, not a model cost.
- **Identity — PASS.** `neutral-identity` and a 50-stroke Body-0 script are **byte-identical**
  between the two engines (and the neutral digests match the committed baseline exactly:
  `d2bd637a / 291d4a11 / 6ba88334`). The Body-0 watercolor path is untouched.
- **Memory — PASS.** One persistent `R16F` coverage target (+2.3 MB at 1080²) replaces a
  per-stroke 17.8 MiB snapshot and blit.

### Investigation trail

1. First formulation exposed a probe-design error: the Body knob was applied to the
   underlayer ring, so Body 30 made the blue band itself a ~1 % film and the crossing read
   paper-white. Fixed by painting the underlayer at Body 0 and keeping the knob on the
   covering stroke — which is the real scenario (an acrylic stroke over existing paint).
2. First white boxes averaged the strokes' alpha rims with paper. Tightened to the stroke
   cores and added the whole-sheet "covered but paper-white" scan.
3. The coverage composite initially skipped `touch()`, leaving the sim/undo bookkeeping
   stale; added the same call `brushInk` makes.
4. The `+9.33 MB` first attributed to painting was a setup-time paper-field scratch; the
   peak is now reset at script start, isolating the per-stroke transient.
5. The coverage run's raw p95 looked worse (135 vs 56.5 ms). A Body-0 control — same
   54-stroke script with the cover path off, engines byte-identical — showed 100.8 vs
   110.3 ms p95 on **both** engines, and the current build's Body-0 p95 exceeds its own
   Body-100 p95. The tail is a periodic shared sim/readback stall, not a model cost; the
   stable numbers are the median and the aggregate bake.

### Bounded limitations (not exercised)

- The app is **not** wired: the cached-base punch/merge path is untouched, as constrained.
  The model's payoff there is demonstrated by the mode-4 alpha (0.98 at the white crossing
  vs 0.18 baseline), not by a live app run.
- Coverage does not advect with the ink, is not in the undo history, and Lift does not
  reduce it. `resetSheet`/`clear` do clear it. Production work required.
- Body now scales the paint film's opacity (the deposit), not only the erase: Body 30 is a
  ~1 % film per dab. Deliberate — but a behaviour change needing UAT/tuning.
- Textured tips share the same mask by construction; only the round brush was exercised.
- Timings are headless Chrome on this machine — a relative comparison, not an app benchmark.
