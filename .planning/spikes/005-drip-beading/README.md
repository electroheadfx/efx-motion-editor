---
spike: 005
idea: gravity-paint-drips
name: drip-beading
type: standard
validates: "Given the real engine with the spike-004 gravity run, when a discrete bead is shed from the loaded wet head, then a droplet leaves the mark and runs ahead of the field tongue, its count/size/threshold follow the controls, and gravity 0 plus a dry sheet stay byte-identical to HEAD"
verdict: "NOT ADOPTED ✗ — the mechanism is validated (beads shed from the wet mask, outrun the field tongue, all four controls move the geometry, replay and neutrality pass) but the artist judged the drop trails insufficiently realistic (2026-11-23) and will not implement the feature for now; gravity-paint-drips is parked"
related: [004, 002]
tags: [webgl2, gravity, drips, beads, acrylic, determinism, spike-005]
---

# Spike 005: Drip Beading

## What This Validates

Given the real `efx-watercolor` engine carrying the spike-004 gravity run, when
a discrete bead is shed from the loaded wet head, then (1) a droplet leaves
the mark and runs **ahead of the field tongue**, (2) the four artist controls
(gravity strength, drip rate, droplet size, trigger threshold) move the
measured geometry, (3) replay is byte-identical, and (4) gravity 0 and a dry
sheet stay byte-identical to HEAD.

## Research

Spike 004 established the transport: the film sags down the sheet, a
document-space value noise gates it into plaques, and the run is a
**continuous** tongue (results/contact-sheet in `../004-...`). A scalar field
cannot bead — it has no surface tension and no discrete mass. The 004 verdict
therefore named a discrete model as the next question.

Seams read from the tree before building:

- The engine already keeps a **binned wet mask** (`wetMask`, 16-texel cells,
  read by `trimActive` every 10 frames) — a 4 KB readback, not a full-field
  stall. The threshold is a shader uniform, so the mask can be re-asked at any
  wet level.
- Deposits are stamped through the `splat` program: `splatInk` (additive in
  the spectral basis) and `splatWet` (MAX). `drawSplat` takes a point, a
  radius and the two colour coefficient vectors.
- The pigment of the stroke under test is on the engine (`pigment.coeffs`,
  7 absorbance-basis coefficients); `scriptBegin` is the one seam that sees the
  tool, which is how the last **paint** colour is distinguished from the
  Water/Lift tools' black.
- The active rect is grown by `touch()`; the awake window is the engine clock,
  so a bead can keep the sim awake while it is in the air.
- The ONE dab law: `ink <- ink*(1-a) + C*a`, `fixed <- fixed*(1-a)`,
  `cover <- cover*(1-a)`. A bead deposit must obey it, not add pigment.

Chosen model: a **CPU bead list** (no new target, no new shader). Each bead is
spawned from the wet mask at the bead threshold, falls at the gravity speed
times an overrun factor, stamps a faint wet/pigment thread plus a full drop
every `BEAD_DOT_SPACING` doc-uv, and dies when its water is spent (one last
dot). The deposits use the splat program and the source-over pair.

## How to Run

```bash
cd .planning/spikes/005-drip-beading
# neutrality: HEAD baseline vs the workbench, beads enabled but gravity 0
node probe/run.mjs --gate neutral-baseline --engine baseline  --gravity 0 --water 0 --ticks 120 --size 512 --scene cross
node probe/run.mjs --gate bead-neutral     --engine workbench --gravity 0 --beads 1 --bead-size 0.008 --water 0 --ticks 120 --size 512 --scene cross
# the field-only control (the 004 pick: noise 1.0 @ 8, water on)
node probe/run.mjs --gate bead-control --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 0 --water 1 --ticks 240 --size 512 --scene cross
# the candidate drop
node probe/run.mjs --gate bead-s8 --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.05 --bead-speed 1.6 --water 1 --ticks 240 --size 512 --scene cross
# sweeps: rate / size / threshold / speed / gravity / duration
node probe/run.mjs --gate bead-rate03  --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 0.3 --bead-size 0.008 --bead-thr 0.05 --bead-speed 1.6 --water 1 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-size12  --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 1 --bead-size 0.012 --bead-thr 0.05 --bead-speed 1.6 --water 1 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-thr15   --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.15 --bead-speed 1.6 --water 1 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-speed10 --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.05 --bead-speed 1.0 --water 1 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-g10     --engine workbench --gravity 1   --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.05 --bead-speed 1.6 --water 1 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-long    --engine workbench --gravity 0.5 --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.05 --bead-speed 1.6 --water 1 --ticks 600 --size 512 --scene cross
# the wetness gate: today's acrylic wetness only
node probe/run.mjs --gate bead-dry-off --engine workbench --gravity 1 --gain 0.08 --noise 1 --beads 0 --water 0 --ticks 240 --size 512 --scene cross
node probe/run.mjs --gate bead-dry-on  --engine workbench --gravity 1 --gain 0.08 --noise 1 --beads 1 --bead-size 0.008 --bead-thr 0.05 --water 0 --ticks 240 --size 512 --scene cross
# determinism: rerun bead-s8 as bead-s8-dup — all four digests must match
```

One engine per process, headless Chrome, paper `cold` pinned at seed
`0xc0ffee`, the acrylic medium record verbatim, `bristle-flat` at canonical
size 60, no dev server. Results land as JSON + PNG per gate in `results/`.

## What to Expect

- `neutral-*` / `bead-neutral`: identical digests (gravity 0 → no bead spawns).
- `bead-dry-on` vs `bead-dry-off`: identical digests, 0 beads (the acrylic's
  own wet peak is 0.0107, under the 0.05 threshold).
- `bead-s8` vs `bead-control`: the paint's bottom edge falls well past the
  field tongue, and the drop list shows one bead per plaque lane.
- Sweeps: the bottom edge and the bead count move monotonically with the
  parameter; `bead-speed10` is the no-detach control.
- `bead-s8` and `bead-s8-dup`: identical digests and bead lists.

## Investigation Trail

1. **Field-only first.** The 004 pick (gravity 0.5, gain 0.08, noise 1.0 @ 8)
   reproduces exactly: bottom 0.2959, 10 px tongue, wet mass 4746. This is the
   control the beads must beat.
2. **First bead pass: continuous streaks.** Beads spawned from the wet mask
   and stamped every other tick produced 100 px hairlines: the field can only
   accumulate the head stamp along the path, so a blob per tick becomes a
   straight line. Named the limit: a scalar field cannot erase its previous
   head.
3. **Beaded trail.** A faint thread every other tick plus a full drop every
   0.014 doc-uv of fall, and one last dot when the bead dries, reads as a
   chain of drops with a terminal bulge (results/bead-s8-crop.png). The chain
   spacing is the droplet cadence; the radius is the droplet size.
4. **The dab law.** The first build added pigment additively, which darkens
   overlaps and drifts hue. The deposit now does the shipped source-over pair
   (attenuate by `a`, then add `C·a`) on the splat's Gaussian — same law as a
   dab, no new shader.
5. **Spawn is the film, not the stroke.** At each wave (333 ms) the wet mask
   is asked at the bead threshold; each **free lane** sheds at most one bead
   at its lowest wet cell. A lane refills after its bead dies (~2.5 s at
   `BEAD_TAU` 1.2 s and the 0.12 water floor), so a loaded plaque keeps
   shedding drops (73 over 10 s in `bead-long`).
6. **Detach needs the overrun.** With `beadSpeed` 1.0 the bead falls with the
   field and the bottom is 0.1572; at 1.6 it reaches 0.0986 — the drop
   outruns its own tongue.
7. **Controls move the geometry.** Gravity 1.0 reaches the sheet bottom
   (0.0010); size 0.012 gives thicker drops (0.0654); threshold 0.15 starts
   the drop higher on the film (0.1514, 7 lanes); rate 0.3 gives 5 drops
   instead of 8 (0.1240).
8. **Determinism.** No RNG; the lane/wave hash is the only entropy. Two
   independent runs of `bead-s8` give the same four digests and the same bead
   list.
9. **Neutrality.** `bead-neutral` (gravity 0, beads enabled) and
   `bead-dry-on` (gravity 1, dry acrylic) are byte-identical to the HEAD
   baseline and to the beads-off dry control. The bind is the wetness: today's
   acrylic never reaches the bead threshold.
10. **A lane boundary artefact.** The vertical stroke sits at x 0.5, exactly a
    boundary of the 8 noise lanes, so it sheds two parallel beads. The lane
    count is the gravity noise scale; a product would align lanes to the
    plaque field or merge boundary neighbours.

## Results

### Bead matrix (cross scene, 512², gravity 0.5 / gain 0.08 / noise 1 @ 8 unless noted)

| Gate | Setting | bottom (uv) | spawned / alive | lowest bead | painted % | bottom spread (px) |
|---|---|---|---|---|---|---|
| bead-control | field only | 0.2959 | 0 / 0 | — | 21.8 | 10 |
| **bead-s8** | **size 0.008, thr 0.05, rate 1, speed ×1.6** | **0.0986** | **16 / 8** | **0.1068** | **26.0** | **25** |
| bead-size12 | size 0.012 | 0.0654 | 16 / 8 | 0.0756 | 29.0 | 34 |
| bead-rate03 | rate 0.3 | 0.1240 | 9 / 5 | 0.2204 | 24.8 | 12 |
| bead-thr15 | thr 0.15 | 0.1514 | 15 / 7 | 0.2006 | 25.7 | 26 |
| bead-speed10 | speed ×1.0 | 0.1572 | 16 / 8 | 0.1625 | 24.5 | 14 |
| bead-g10 | gravity 1.0 | 0.0010 | 22 / 8 | 0.0105 | 31.1 | 64 |
| bead-long | 600 ticks (10 s) | 0.0010 | 73 / 8 | 0.0016 | 31.6 | 140 |

"bottom spread" counts painted columns within 8 px of the lowest row across
the whole sheet — with several drops it measures spread, not one drop's width.

### Controls: neutrality, determinism, the wetness gate

| Gate | engine | gravity | beads | water | digests (paper / transparent / white / pigment) | spawned |
|---|---|---|---|---|---|---|
| neutral-baseline | HEAD | 0 | — | off | c4d3889f / 9ac47d8b / 56511439 / 3a6aec3b | — |
| bead-neutral | workbench | 0 | 1 | off | c4d3889f / 9ac47d8b / 56511439 / 3a6aec3b | 0 |
| bead-dry-off | workbench | 1 | 0 | off | c4d3889f / 9ac47d8b / 56511439 / 3a6aec3b | 0 |
| bead-dry-on | workbench | 1 | 1 | off | c4d3889f / 9ac47d8b / 56511439 / 3a6aec3b | 0 |
| bead-s8 | workbench | 0.5 | 1 | on | fe870915 / c6c865d2 / 75cc4705 / 482e048c | 16 |
| bead-s8-dup | workbench | 0.5 | 1 | on | fe870915 / c6c865d2 / 75cc4705 / 482e048c | 16 |

### Cost

| Gate | beads | bake ms (241 ticks) |
|---|---|---|
| bead-control | 0 | 413 |
| bead-s8 | 16 spawned / 8 alive | 543 |
| bead-rate03 | 9 / 5 | 473 |
| bead-thr15 | 15 / 7 | 497 |
| bead-g10 | 22 / 8 | 498 |
| bead-long | 73 / 8 | 967 (601 ticks) |

The bead pass costs ~+31 % at the candidate setting. The spawn adds one 4 KB
`readPixels` per wave (every 333 ms), not a per-tick field readback. The cost
is a 512² SwiftShader figure for the sculpture, not a product budget; spike
006 owns the real bake/live cost.

### Verdict summary

- **A drop leaves the mark: PASS.** The bead model outruns the field tongue
  (bottom 0.2959 → 0.0986 at g 0.5 / 4 s) and keeps falling while it owns
  water. The zoom shows the chain and the terminal drop.
- **Discrete droplets: PASS for a *running* drop.** The bead is a discrete
  entity with its own mass/size/lane; it is not a free-falling surface-tension
  bead (the head is its last stamp, not a meniscus). That is the artist's
  "goutte qui coule", not a detached ball.
- **The four controls: PASS.** gravity → reach (0.0010 at g 1); rate → number
  of drops (5 at 0.3 vs 8 at 1.0); size → width and reach (0.0654 at 0.012);
  threshold → where the drop starts on the film (0.1514 at 0.15).
- **Determinism: PASS within the harness.** Two runs → identical digests and
  bead lists.
- **Neutrality: PASS.** Gravity 0 with beads enabled is byte-identical to
  HEAD; the dry acrylic stays under the bead threshold (0 beads, identical to
  the beads-off dry control).

Verdict: **NOT ADOPTED ✗** — technically validated, artist-rejected. A
beading model is feasible on the real engine with no new target and no new
shader, but the artist judged the drop trails insufficiently realistic and
will not implement the feature for now (2026-11-23). The spike is evidence,
not a plan; do not reopen by tuning these knobs. A future attempt needs a
genuinely different realism model (real surface tension / free-falling mass,
e.g. a GPU particle simulation), and the artist's go first. Spike 006 is not
pursued.

## Limitations

- One scene (cross), one sheet (512²), one medium (acrylic). The drops' px
  sizes/rates scale with the sheet because the bead size is doc uv and the
  mask is 16 texels; a size law across 1080²/2K is not measured.
- The spawn source is the **binary wet mask** at the threshold, not a graded
  film load: the drop's initial water/size is fixed (1 water, size from the
  parameter plus a lane/wave hash), not proportional to the local film.
- The bead is fed at spawn and dries as it falls; it does not pick up wet
  along the path, and it has no surface tension. The "detached bead" is a
  running drop with a beaded trail, not a free-falling sphere.
- No undo integration: the per-tick bead deposits are not protected for undo
  (the whole drip belongs to one stroke-scale step). No live/bake parity or
  KEY = CACHE contract here — spike 006.
- The lane count is the gravity noise scale; the cross's vertical stroke sits
  on a lane boundary and sheds two parallel beads.
- The workbench is a copy of the 004 workbench (gravity patch included) plus
  the bead patch. Patches in `patches/` are against the main tree and contain
  both.
