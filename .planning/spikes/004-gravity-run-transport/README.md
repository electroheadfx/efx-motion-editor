---
spike: 004
idea: gravity-paint-drips
name: gravity-run-transport
type: standard
validates: "Given the real engine on a wet acrylic sheet, when a gravity term drives the fluid transport, then paint leaves the stroke and runs downward with a run length that grows with the parameter, and gravity 0 is byte-identical to HEAD"
verdict: "PARTIAL ⚠ — gravity transport is live, directed and neutral at 0, but the field-offset model produces a faint sag (13-16 px at 512) and destroys the water film (mass -55 % at g 0.5, -78 % at g 1); it is not enough for droplets"
related: [002, 003]
tags: [webgl2, gravity, fluid, drips, acrylic, determinism, spike-004]
---

# Spike 004: Gravity Run Transport

## What This Validates

Given the real `efx-watercolor` engine loaded with a wet acrylic sheet, when a
gravity term drives the fluid transport (`advectWet` / `advectInk` /
`advectCover`), then (1) paint leaves the stroke and moves **down** the sheet,
(2) the run grows with the gravity parameter, and (3) gravity 0 is
**byte-identical** to HEAD.

## Research

Engine facts established before building (read from the tree, not assumed):

- One fluid sim serves every medium: `advectVelocity → curl → vorticity →
  divergence → pressure → gradient → advectWet → settle → advectInk →
  advectCover` (`Engine.ts` `step()`). A bristle/acrylic deposit lands in the
  same mobile `ink` layers the watercolor sim transports, so gravity is one
  shared law, not an acrylic-only path.
- The sim has **no gravity term at all** today: wetness moves only by the
  velocity field, isotropic diffusion (`uSpread`) and the wetness-gradient
  edge flux.
- Pigment mobility is gated by `mobility(w) = smoothstep(0.02, 0.45, w)`
  (both ink and cover passes).
- Today's acrylic brush records (`bristle-flat` water 0.05, `bristle-round`
  0.06) put the per-dab wet at ~0.018 with the acrylic medium (Water 26) —
  below the mobility ramp. The acrylic never flows; this is a **data** fact,
  not a missing mechanism.
- The wet sim runs inside an **active rect** that grows ~0.4 px/frame; every
  pass is scissored to it and the ping-pong halves are re-synced by a blit on
  trim (`trimActive`).

Chosen approach: a gravity **offset in uv space** applied to the sampling
coordinate of the three advection passes, with its own gate, one param
`gravity: 0..1` (spike-only `Params.gravity`, default 0). No new targets, no
new passes — the smallest change that can answer the question.

## How to Run

```bash
cd .planning/spikes/004-gravity-run-transport
# neutrality (baseline HEAD vs workbench)
node probe/run.mjs --gate neutral-baseline --engine baseline  --gravity 0 --water 0 --ticks 120 --size 512
node probe/run.mjs --gate neutral-final    --engine workbench --gravity 0 --water 0 --ticks 120 --size 512
# the sweep (water pass = the wetness gate unlocked)
for g in 0 0.5 1 2; do
  node probe/run.mjs --gate "final-g$g" --engine workbench --gravity $g --water 1 --ticks 120 --size 512
done
# today's acrylic wetness only (no water pass) — the no-run control
node probe/run.mjs --gate final-dry-g1 --engine workbench --gravity 1 --water 0 --ticks 120 --size 512
```

One engine per process, headless Chrome, paper `cold` pinned at seed
`0xc0ffee`, the acrylic medium record verbatim, `bristle-flat` at canonical
size 60. No dev server. Results land as JSON + PNG per gate in `results/`.

## What to Expect

- `neutral-*`: identical digests at gravity 0 (paper / transparent / white /
  pigment).
- `final-g*`: the paint-mask bottom edge (p90 column) drops as gravity rises,
  the painted share grows slightly, and the water's own centroid drops — then
  the effect saturates as the water mass collapses at high gravity.
- `final-dry-g1`: nothing moves (0 % of the sheet is above the mobile floor).

## Investigation Trail

1. **Neutrality first.** Workbench with `gravity = 0` reproduces HEAD exactly:
   all four export digests equal (`587b302e / 81e96eab / 71a39e43 /
   32b00f45`). The offset term is a multiply by zero, so the shipped law is
   untouched by construction.
2. **First sweep: no visible run.** Digests changed with gravity, but the
   paint mask barely moved (p90 bottom 0.5947 → 0.5811 at g 1). The water
   centroid moved ~5 px over 120 ticks where the arithmetic predicted ~82 px
   at 512². Instrumented the wet field (`readWetField`) — the water was
   losing mass instead of translating.
3. **Ruled out the active rect.** The rect grows by ~0.4 px/frame while the
   gravity offset moves the film faster; added a gravity term to the grow law
   in both `tick` and `frame`. No change — the sag was not rect clipping.
4. **Ruled out the scissored ping-pong.** Drew the wet pass full-target when
   gravity > 0. No change (mass 1710.8 → 1711.7 at g 1). Reverted.
5. **Isolated the mechanism.** Pure offset advection (`texture(uWet, vUv +
   g·dt)` only, no velocity, no smoothing) moved the wet centroid **83 px**
   at g 1 — exactly the predicted 0.00133 uv/frame × 120 — with mass
   conserved (2176 vs 2172). The transport mechanism is sound.
6. **Named the limiter.** Re-adding the smoothing showed 4.7 px. The gate is
   `smoothstep(0.02, 0.45, w)` — the **pigment-mobility ramp**. It is a
   strong nonlinearity: only the peak of the film (~0.2) sits above the
   ramp's midpoint, most of the band sits at 0.02-0.10 where the ramp is
   ~1-14 %. Gating gravity by it cancels ~95 % of the motion. Gravity got its
   own gate, `smoothstep(0.004, 0.08, w)`, in all three passes.
7. **Water-mass collapse.** With the soft gate the film finally moves
   (centroid 0.6218 → 0.5921 at g 0.5), but its mass falls from 2229 to 995
   (g 0.5), 480 (g 1) and 304 (g 2) — evaporation alone accounts for 0.745 at
   2 s. The advected film erodes at the top (samples above the band) faster
   than it accumulates below, so the run is faint and saturates.
8. **The pigment follows only partly.** The ink advection adopts the shifted
   sample with the same `m` weight (`mix(A, sample, m)`), so where the film is
   thin the pigment lags the water. Net visible run at g 0.5: the p90 column
   bottom drops **16 px** at 512² (3 % of the sheet height) over 2 s, painted
   share 10.2 → 10.5 %.
9. **The wetness gate is real.** Without the Water pass, gravity 1 on today's
   acrylic leaves the sheet at 0 % mobile (peak 0.0147, under the ramp): no
   run at all. The acrylic's own wetness must be raised for gravity to act.

## Results

### Single horizontal stroke

| Gate | gravity | water pass | painted % | p90 bottom (doc uv) | wet centroid | wet mass |
|---|---|---|---|---|---|---|
| neutral-baseline (HEAD) | 0 | off | 9.7 | 0.5537 | — | — |
| final-g0 | 0 | on | 10.2 | 0.5947 | 0.6218 | 2229 |
| final-g0.5 | 0.5 | on | 10.5 | 0.5635 | 0.5921 | 995 |
| final-g1 | 1 | on | 10.5 | 0.5654 | 0.6014 | 480 |
| final-g2 | 2 | on | 10.4 | 0.5693 | 0.6053 | 304 |
| final-dry-g1 | 1 | off | 9.7 | 0.5537 | 0.6186 | 117 |

On one horizontal stroke the run grows from g 0 to g 0.5 (+16 px) and then
**regresses** (g 1: +14 px, g 2: +13 px) as the film erodes. A single thin
stroke cannot feed a drip: the water is consumed before the paint travels.

### Cross scene (the artist's scene, 2026-11-23)

One horizontal and one vertical acrylic stroke crossing, both wetted, sheet
512². The vertical stroke's free bottom end is where a drop can shed.

| Gate | gravity | ticks | painted % | mask bottom (doc uv) | p50 column bottom | wet centroid | wet mass |
|---|---|---|---|---|---|---|---|
| cross-dry-g2-t240 | 2 | 240 | 16.3 | 0.3760 | 0.5400 | 0.6614 | 206 |
| cross-g0 | 0 | 120 | 18.2 | 0.3213 | 0.5225 | 0.6204 | 6539 |
| cross-g0.5 | 0.5 | 120 | 19.8 | 0.2920 | 0.4834 | 0.5768 | 5561 |
| cross-g1 | 1 | 120 | 20.3 | 0.2803 | 0.4697 | 0.5465 | 4454 |
| cross-g2 | 2 | 120 | 20.6 | 0.2705 | 0.4678 | 0.5025 | 2946 |
| cross-g1-t240 | 1 | 240 | 21.1 | 0.2549 | 0.4561 | 0.5021 | 2498 |
| cross-g2-t240 | 2 | 240 | 21.2 | 0.2412 | 0.4678 | 0.5314 | 1179 |

- **The drip leaves the mark.** Below the vertical stroke's own footprint
  (bottom 0.3760 in the dry control) the paint reaches 0.3213 at g 0 (the
  water bloom alone), 0.2803 at g 1 and 0.2412 at g 2 over 4 s — a tongue
  **41 px long at 512² (8 % of the sheet height)**, monotone with both gravity
  and time in this scene.
- **The wetness gate holds.** Without the Water pass the same g 2 / 240-tick
  scene leaves 0 % of the sheet above the mobile floor and no drip at all.
- **Visual: `results/cross-g0.png` vs `cross-g1.png` / `cross-g2.png` /
  `cross-g*-t240.png`.** The horizontal stroke sags and the vertical stroke
  grows a rounded tongue at its lower end — a running drop, not yet a
  detached bead.
- **Still not droplets.** The tongue is a continuous field: no detached
  bead, no trail of separate drops. That is the model boundary, not a tuning
  problem (a semi-Lagrangian scalar field has no surface tension).

### Field model, pushed (gain + threshold + feed width)

The artist asked whether a **long thin tongue** is enough before investing in
a discrete droplet model. Three levers were added to the workbench and swept
on the cross scene: `gravityGain` (sag speed in sheet-heights/s), a
`gravityThreshold` on the wet film ("loaded enough to run"), and the Water
pass's own brush size (the width of the wet feed).

| Gate | gain | thr | water size | ticks | mask bottom | tongue width | wet mass left |
|---|---|---|---|---|---|---|---|
| cross-dry-g2-t240 | — | — | — | 240 | 0.3760 | 0 | 206 |
| cross-g0 | 0.08 | 0 | 60 | 120 | 0.3213 | — | 6539 |
| long-g008-t360 | 0.08 | 0 | 60 | 360 | **0.2354** | 36 px | 1488 |
| long-g012-t360 | 0.12 | 0 | 60 | 360 | 0.2295 | 47 px | 961 |
| x-g1-g02-t0 | 0.2 | 0 | 60 | 240 | 0.2471 | 48 px | 1000 |
| x-g1-g04-t0 | 0.4 | 0 | 60 | 240 | 0.2725 | 49 px | 592 |
| x-g1-g02-t15 | 0.2 | 0.15 | 60 | 240 | 0.3135 | 26 px | 3745 |
| thin-w20-g02-t0 | 0.2 | 0 | 20 | 240 | 0.3291 | 25 px | 375 |
| thin-w14-g02-t0 | 0.2 | 0 | 14 | 240 | 0.3408 | 16 px | 296 |

- **Longest tongue: gain 0.08-0.12, no threshold, 6 s** — 72 px below the dry
  mark at 512² (14 % of the sheet height), 36-47 px wide.
- **The gain saturates at ~0.2**; 0.4 regresses (bottom 0.2725) because the
  water is consumed faster than it can carry paint.
- **The threshold thins the tongue but shortens it** (thr 0.15: 26 px wide,
  bottom 0.3135). It protects the water (3745 left vs 1000) but gates away
  the very film that feeds the run.
- **A narrow wet feed thins the tongue but starves it** (size 14: 16 px wide,
  bottom 0.3408 — barely past the dry mark).
- **The tongue's width follows the wet feed, its length follows the water
  dose.** A narrower Water pass + more passes (the starve control) gives a
  thin rivulet: feed size 20 x 3 passes → tongue **11 px wide**, bottom
  0.2979 (the same depth as the full-width reference 0.2920). Feed size 30 x 3
  → 99 px long but 31 px wide. The proportional law the artist asked for is
  **water width ≈ 1/3 of the brush, 3 passes**.
- **Structural note:** a scalar field still translates rigidly — the rivulet
  is thin because its FEED is thin, not because it converged. A feed that
  suits one brush width must be re-derived per brush; a bead model would
  converge on its own (spike 005).
- A `focus` exponent (sag ∝ wet^p) was added and swept (p 2/4/8): it does not
  narrow the tip on this scene (27-29 px at every p once the gain
  compensates) — the wet profile is too flat for the power to separate a
  core. Recorded so 005 does not retry it.
- `pow(0,0)` is undefined in GLSL: the first focus build read NaN on the dry
  film and silently stretched the reference result (0.2920 → 0.3018). The
  uniform branch (`focus > 0 ? pow(...) : 1`) restored the reference exactly.

### Patchy drips (the artist's "don't let the whole stroke run")

A **document-space value noise** gates gravity, so a mark drips in patches
instead of sagging uniformly. It is a pure function of the texel position (no
time, no RNG) — deterministic and re-bake-safe by construction — and
document-space means the drips form in fixed vertical lanes.

Scene: the artist's request — the horizontal stroke extended to x 0.06..0.94,
full-width Water pass, gravity 0.5, gain 0.08, 4 s.

| Gate | noise | bottom | run below the mark | tongue width | wet mass left |
|---|---|---|---|---|---|
| cross-dry | — | 0.3760 | 0 px | 0 | 206 |
| noise-n0 | 0 | 0.2744 | 52 px | 25 px | 3709 |
| noise-n05 | 0.5 @ 8 | 0.2783 | 50 px | 20 px | 4160 |
| noise-n08 | 0.8 @ 8 | 0.2822 | 48 px | 13 px | 4560 |
| **noise-n10** | **1.0 @ 8** | 0.2959 | 41 px | **10 px** | 4746 |
| noise-n10-s4 | 1.0 @ 4 | 0.2744 | 52 px | 22 px | 5544 |
| noise-n10-s16 | 1.0 @ 16 | 0.2998 | 39 px | 23 px | 5231 |

- **Noise thins the run at almost no depth cost** (25 px → 10 px tongue for
  52 px → 41 px of run) and **conserves the water** (3709 → 4746) because
  fewer texels sag.
- **Scale 8** is the patch size that reads as separate runs; 4 gives fewer,
  bigger patches; 16 thins it but shortens the run.
- **The narrow-water feed is abandoned** (measured starve: bottom 0.32-0.34,
  a 12 px tongue that never visibly runs). Thinness is now produced by the
  noise, not by starving the feed.

Artifacts: `results/contact-sheet.html` (the patch variants side by side),
`results/noise-n*.png`.

Visual: `results/contact-sheet.html` (open in a browser) — the reference
(no water / no gravity), the long tongue, the heavily-loaded variant and the
narrow-feed variant side by side, with the numbers.

### Verdict summary

- **Neutrality: PASS.** Gravity 0 is byte-identical to HEAD on all four
  exports.
- **Direction: PASS.** Paint and water move down the sheet (doc y-up → the
  mask's bottom edge and the wet centroid both fall).
- **A gravity drip that leaves the stroke: PASS in the cross scene**
  (monotone 0 → 41 px at 512² over 4 s), FAIL on a single thin stroke.
- **Discrete droplets: not reachable in this model.** The offset advects a
  continuous field; it cannot bead. A discrete model is required (spike 005).

Verdict: **PARTIAL ⚠** — gravity transport is feasible, deterministic in
principle (the sim is a pure function of the recorded script and the engine
clock), and neutral at 0. It produces a real running tongue out of a
vertically-fed mark, but not the detached droplets the artist asked for. The
next spike must test beading models, not tune this one.

## Limitations

- One scene (a horizontal line), one sheet size (512²), one medium record.
  The run's absolute length does not transfer to 1080²/2K without a size law
  (the offset is in uv, so px length scales with the sheet).
- The gravity gain (`GRAV_UV_PER_S = 0.08` uv/s at param 1) was chosen for the
  test; the parameter sweep covers 0-2 and the gain is a free constant.
- No live/bake parity gate here — the time-evolution parity contract is spike
  006's question.
- The workbench patch is captured in `patches/Engine.diff` and
  `patches/shaders.diff`; the workbench copy itself is disposable.
