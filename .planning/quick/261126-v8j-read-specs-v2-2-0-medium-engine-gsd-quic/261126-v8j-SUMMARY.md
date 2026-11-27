---
phase: 261126-v8j
plan: 01
subsystem: medium-engine/bristle-gather
tags: [feather-noise, feather-falloff, shader-permutation, identity, edge-rows, uat-unclaimed]
requires:
  - 261125-kvl stroke layer (Spec 10) — Edge transparency / Edge falloff rows and the pointwise merge, untouched
  - SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-11-feather-noise.md (revisions 2026-11-26 and 2026-11-27)
provides:
  - the artist-approved Feather-noise FRONT law (three-scale cloud, contained fringe, sparse spikes) behind Feather noise 0..100
  - Feather falloff as the SHIPPED 2^(2b-1) rim-opening shape (reuses edgeFalloffExponent; no second table)
  - a neutral/extended shader PERMUTATION — at-rest bytes equal the pre-change baseline at Sizes 4 / 12 / 40 / 200
  - the two bristle-only Edge rows in the Paint panel and the Studio top bar (18 medium keys, 20 global keys, Reset inherits)
affects:
  - every gather consumer (deposit, cover, relief, stroke layer) through the shared gather program selector
  - the medium records, the per-stroke recorded bag and the Reset batch
tech-stack:
  added: []
  patterns:
    - one generator, two sources — the neutral source is the pre-change text; the law compiles lazily
    - piecewise-linear slider drive (`featherNoiseDrive`) decouples the artist's scale from the shader amount
    - document-scale fractal cloud (20/60/200 px, four octaves, rotated per octave)
key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - packages/efx-watercolor/src/playground/featherNoise.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/relief.test.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/mediumSelection.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
decisions:
  - "Identity is a shader permutation, not a tolerance: the default programs are literally the pre-change gather."
  - "Slider 0..20 is the plain block (drive 0); the law program first compiles above 20 or when the falloff leaves 50."
  - "The dead period/FEATURES twins stay exported and unit-tested (the spec still names them); the shader no longer reads them."
status: incomplete
completed_at: null
commits: [82ce9df9a, b7e56f2b4, eeaca81c2]
---

# quick 261126-v8j — Feather noise + Feather falloff (probe preview handover)

## Verdict

Engine, law, UI plumbing and all automated gates are GREEN. The identity gate is
**hard-PASS**: the neutral gather reproduces the pre-change digests byte-for-byte at
Sizes 4 / 12 / 40 / 200. The five artist anchors (0 / 20 / 40 / 60 / 100) are
captured and match the approved progression. **The twelve live-UAT rows are
UNCLAIMED** — the probe preview is complete; the artist's live check is the next
step, and no row is marked passed here.

## The shipped laws

### Feather noise (0..100, default 0) — the approved front

```
uN       = clamp(lateral / uFeatherNoiseAnchor, 0, 1)   // BRISTLE_LAYER_EDGE: 0 centre, 1 visual edge
pen      = mix(0.88, 0.35, uFeatherNoise)
front    = pen + cloudMix(css) * 0.30
envelope = smoothstep(front - 0.015, front + 0.015, uN)
featherShift += uFeather * uFeatherNoiseLift * envelope          // paint OUTSIDE the front is removed
featherShift += uFeather * uFeatherNoiseLift * band * spray      // the contained fringe
featherShift -= uFeather * uFeatherNoiseLift * envelope * 0.90 * spike
featherShift -= uFeather * spike * reach                         // the sparse outward spikes
```

- `cloudMix` = three FIXED document scales — 20 / 60 / 200 px — of a four-octave
  rotated value-noise fractal, mixed 0.40 / 0.33 / 0.27. Same field at every size.
- Threshold-only; the paper height line is PRE's statement verbatim; gated by
  `uFeather` (Feather 0 inert) and dead below slider 20.
- The slider is the artist's scale (`featherNoiseDrive`, bristles.ts):
  `0..20 → 0`, `20..60 → n − 0.2`, `60..100 → 0.4 + (n − 0.6)·1.5`.

### Feather falloff (0..100, default 50)

The SHIPPED `2^(2b−1)` exponent of the rim opening (`edgeFalloffExponent` is the
single twin); `pow` is skipped when the bias is exactly 0.5. It shapes the opening
only — the front law carries its own depth drive.

### The permutation (the identity mechanism)

`bristleGatherSource(extended)` is the ONE generator:

- `false` — the NEUTRAL gather: no cloud, no law uniforms, PRE statement order.
  The engine builds `bristleDepositNeutralFS` / `bristleCoverNeutralFS` /
  `bristleReliefNeutralFS` / `bristleCoverLayerNeutralFS` at construction.
- `true` — the EXTENDED gather (the law). `gatherProgram()` compiles the four
  variants on the first draw where
  `featherNoiseDrive(noise) > 0 || featherFalloff !== 0.5`, then binds them.

The neutral consumer is derived from the ONE extended consumer by replacing the
gather substring, so the rest of each program cannot diverge between variants.

## Identity vs PRE (hard gate)

Command: `compare.mjs fn-pre-id-s{size} --other fn-final-id-s{size}`.

| Size | Result |
|---|---|
| 4 | PASS — all 12 fields equal |
| 12 | PASS — all 12 fields equal |
| 40 | PASS — all 12 fields equal |
| 200 | PASS — all 12 fields equal |

The 12 fields include `digestPaper`, `digestTransparent`, `digestWhite`,
`digestPigment` and `byteLength`; this is byte equality, not a tolerance.

## The artist's five anchors

Crops at the approved fixed size (stroke 120, sheet 1080):
`/tmp/medium-engine/fn-anchor-{0,20,40,60,100}-s120-crop.png`.

| Slider | Drive | Observed |
|---|---|---|
| 0 | 0 | Plain block — the neutral program |
| 20 | 0 | **Byte-identical to 0** (`compare.mjs` PASS, all 12 fields) |
| 40 | 0.2 | Light fringe |
| 60 | 0.4 | Medium — the fringe breaks deeper |
| 100 | 1.0 | Full halo — detached specks and the thin middle |

## Anchor grid (Sizes 4 / 12 / 40 / 200 × 0 / 20 / 40 / 60 / 100)

Cross-section metrics (centre row): rim = mean cover over 0.70–0.95 of the
half-width; core = mean cover within ±10 px; outer = the largest |offset| with
cover ≥ 0.10.

| Size | 0==20 | n20 rim / core / outer | n40 | n60 | n100 |
|---|---|---|---|---|---|
| 4 | yes | .0768 / .8357 / 12 | .0321 / .7875 / 11 | .0212 / .7350 / 10 | .0727 / .5019 / 12 |
| 12 | yes | .0689 / .9015 / 20 | .0139 / .9019 / 18 | .0080 / .9013 / 17 | .0220 / .7103 / 18 |
| 40 | yes | .1131 / .9966 / 84 | .0253 / .9970 / 76 | .0053 / .9972 / 69 | .0234 / .9974 / 62 |
| 200 | yes | .1299 / 1.0000 / 122 | .0282 / 1.0000 / 114 | .0116 / 1.0000 / 100 | .0307 / 1.0000 / 107 |

Reading: the rim thins monotonically 20 → 40 → 60 at every size (the front
penetrates inward); at 100 the fringe/spikes lift the outer band back up — the
approved halo. The body stays plain at Sizes 40 / 200 (core 0.997–1.000). At
Sizes 4 / 12 the ±10 px "core" band reaches past the tiny mark's own front, so
its mean drops at 100; this is a measurement-window limit, not a body island.

## Falloff sweep (noise 0, Sizes 40 / 200)

Crops: `/tmp/medium-engine/fn-fall-s{40,200}-f{0,50,100}-crop.png`.

| Size | f0 | f50 | f100 |
|---|---|---|---|
| 40 | half-peak 72 px, outer 84 px | same | same |
| 200 | half-peak 107 px, outer 122 px | same | same |

Honest reading: at these operands the exponent's opening change is below the
1-px cross-section resolution — the branch is pinned by source and unit tests
(`exp2(2.0 * uFeatherFalloff - 1.0)`, skip at 50), and UAT row 6 is the human
arbiter of the visible spread.

## Gates

| Gate | Result |
|---|---|
| `pnpm --dir packages/efx-watercolor exec vitest run` | 44 files, **1158 passed**, 8 skipped |
| `pnpm --dir packages/efx-watercolor check` | clean |
| `pnpm --dir packages/efx-watercolor build` | success |
| `pnpm --dir app exec vitest run` | 467 files passed, **9877 passed**, 4 skipped, 96 todo |
| `pnpm --dir app exec tsc --noEmit` | clean |
| Neutral identity vs PRE (4 sizes) | PASS, 12/12 fields each |

## Cost

`bakeMs` rose 30–32 → 58–59 ms on the first non-neutral capture at Sizes 40 and
200; `renderMs` is unchanged (76–82 ms both). The bake delta is the ONE-TIME lazy
compile of the four extended programs inside that first capture; a live session
pays it once, on the first stroke above slider 20 or off falloff 50.

## UI plumbing (as declared by the spec)

- `mediums.ts`: `MediumParamKey` gains both keys; watercolor derives 0 / 50, the
  acrylic (Gouache) record states 0 / 50. Eighteen medium keys.
- `aquarelleRecordState.ts`: both keys in `AQUARELLE_GLOBAL_KEYS` after
  `edgeFalloff` (twenty keys), defaults 0 / 50; the recorded bag and the
  selection write allowlist carry them automatically.
- `aquarelleParamVisibility.ts`: two rows appended in the existing `edge` group,
  after Edge falloff — group order: Feather, Edge transparency, Edge falloff,
  **Feather noise**, **Feather falloff**. Both are `paint: BRISTLE_MEDIA`, render
  through the existing `GlobalSlider`, and the Studio top bar follows through
  `isAquarelleParamRowVisible`.
- Reset restores the active medium record, which now includes both keys — no
  Reset branch was added.

## Honest limits

1. **The period-based probe gate is superseded.** `probe/medium-engine/featherNoise.mjs`
   measures the rejected grain-mix bars (periodPx / rimCrossings / core-rim RMS).
   It is NOT a pass for this law and was not used as one. The anchor grid, the
   identity gate and the source pins are the automated evidence.
2. **Dead twins.** `FEATHER_NOISE_FEATURES / _MIN_PX / _MAX_PX / _REFERENCE_PX /
   _DEPTH / _FLOOR`, `featherNoisePeriodPx` and `featherNoiseScale` remain
   exported and unit-tested (the spec still names them), but the extended shader
   declares only the four live uniforms and the engine no longer binds the rest.
   A later cleanup can retire them with their tests.
3. **Tiny brushes.** At Sizes 4 / 12 the document-scale cloud is barely resolved;
   the accepted reading is a ragged, sparse break — never a smooth line.
4. **The artist's eye is the arbiter** of the interior blend, the double-texture
   question and the falloff's visible spread. None of those is inferred here.

## Live UAT rows (UNCLAIMED — awaiting the artist)

Surface legend: **L** live during the stroke · **S** after settle · **R** leave /
reopen + forced re-render · **U** Undo / Redo.

| # | Scenario | Expected | Surface | Status |
|---|---|---|---|---|
| 1 | Defaults (noise 0, falloff 50) at sizes 4 / 12 / 40 / 200 | Byte-identical render — the neutral program | L S R U | UNCLAIMED (automated identity PASS) |
| 2 | Size 4–8, Feather 100, noise 100 | The rim is visibly broken (not a smooth cut); paper character shows | L S | UNCLAIMED |
| 3 | Sizes 40 and 200, Feather 100, noise 100 | The document-scale cloud resolves differently at 40 and 200 — not two identical marks | L | UNCLAIMED |
| 4 | The five anchors at a fixed size: 0 / 20 / 40 / 60 / 100 | 0 and 20 plain, 40 light fringe, 60 medium, 100 full halo; linear between, no jumps | L S | UNCLAIMED (automated grid: 0==20, rim 20>40>60 at every size) |
| 5 | Noise 100 — the full halo | Sparse spikes reach past the base edge; the fringe is contained; the body stays plain (no detached islands) | L S | UNCLAIMED |
| 6 | Falloff 0 / 50 / 100 at a fixed noise | The rim opening spreads toward the core / stays shipped / hugs the silhouette; the outer silhouette unchanged | L S | UNCLAIMED (cross-section resolution limit noted) |
| 7 | Feather 0 with both rows moved | Inert — no opening, no noise | L | UNCLAIMED |
| 8 | Pen (bristle response) and Watercolor | Pen gets the same edge; Watercolor shows no rows and renders identically | L | UNCLAIMED |
| 9 | Over a committed base / restored key | No milky halo; the merge parity holds | S R | UNCLAIMED |
| 10 | Edge transparency 100 with noise 100 | The stroke layer commits with the front intact (pointwise merge); the under shows through the faded band only | S R | UNCLAIMED |
| 11 | Leave/reopen + forced re-render; Undo/Redo | The bake matches the live view; the stroke undoes/redoes as one edit | R U | UNCLAIMED |
| 12 | Curved S-stroke at size 6, noise 100 | No lane/band motif; the body stays plain | L | UNCLAIMED |

## Commits

- `82ce9df9a` — the approved feather-noise law (front, cloud, spikes).
- `b7e56f2b4` — RED pins: neutral/extended permutation + the two UI rows.
- `eeaca81c2` — GREEN: the permutation (one generator, lazy extended programs)
  and the UI wiring (18 medium keys / 20 global keys).

The artist's in-progress skill files (`.claude/skills/efx-studio-paint/SKILL.md`
and `references/edge-transparency.md`) were deliberately not staged.
