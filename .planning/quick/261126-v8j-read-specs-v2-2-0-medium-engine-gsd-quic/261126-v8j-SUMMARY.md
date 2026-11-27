---
phase: 261126-v8j
plan: 01
subsystem: medium-engine/bristle-gather
tags: [feather-noise, feather-falloff, shader-permutation, identity, edge-rows, three-scale-breakup, slider-reindex, uat-approved]
requires:
  - 261125-kvl stroke layer (Spec 10) — Edge transparency / Edge falloff rows and the pointwise merge, untouched
  - SPECS/v2.2.0-medium-engine/GSD-QUICK-PROMPT-11-feather-noise.md (revisions 2026-11-26, 2026-11-27, 2026-11-27k)
provides:
  - the artist-approved Feather-noise law — the delivered three-scale cloud (20/60/200 px) behind a RE-INDEXED slider: 0 clean edge, 20 the shipped base (default), 40 light, 60 medium, 100 full breakup
  - Feather falloff as the SHIPPED 2^(2b−1) rim-opening shape (reuses edgeFalloffExponent; no second table)
  - a neutral/extended shader PERMUTATION — slider 20 + falloff 50 renders the pre-change bytes; the law compiles lazily at every other value
  - the two bristle-only Edge rows (18 medium keys, 20 global keys) with featherNoise default 20
affects:
  - every gather consumer (deposit, cover, relief, stroke layer) through the shared gather program selector
  - the medium records, the per-stroke recorded bag, Reset, the Paint panel and the Studio top bar
tech-stack:
  added: []
  patterns:
    - one generator, two sources — the neutral source is the pre-change text; the law compiles lazily
    - re-indexed slider — edgeClean = smoothstep(0, 20, n) scales the shipped edge; breakupDrive = (n − 20) / 80
    - document-scale three-noise cloud (20/60/200 px, four octaves, rotated) + contained fringe + sparse spikes, floored at the base silhouette
key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/bristles.ts
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/featherNoise.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/playground/mediums.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/featherNoise.mjs
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/mediumSelection.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
decisions:
  - "UAT APPROVED live 2026-11-27 (artist: 'approbated ticket/quick now')."
  - "Slider re-index decided live: 0 = clean edge, 20 = the shipped base look, 40 light, 60 medium, 100 full; featherNoise default becomes 20 everywhere so the engine's default look is unchanged."
  - "At slider 20 + falloff 50 the NEUTRAL program runs — the slider-20 render is byte-identical to the pre-change baseline (digest-verified), and the extended programs compile lazily at every other value."
  - "The breakup is the delivered three-scale cloud (20/60/200 px). The two rejected live attempts — the uniform fine chip field ('animal fur', 65caecb54) and the smooth single-field erosion (84faa5aee) — were reverted; the artist asked for the 3-noise mix back."
  - "The front is softened to ±0.04 uN. The footprint floor featherShift = max(featherShift, shippedShift) lets chips cancel the erosion but never paint beyond the base mark."
status: complete
completed_at: 2026-11-27
commits: [82ce9df9a, b7e56f2b4, eeaca81c2, 3cd29a50e, e56941eba, 2c5441af4, e8c696567]
---

# quick 261126-v8j — Feather noise + Feather falloff (UAT APPROVED)

## Verdict

**UAT APPROVED live 2026-11-27** (artist: "approbated ticket/quick now"). The
shipped law is the delivered three-scale Feather-noise law, re-indexed after the
live tuning so that slider **0 is a clean edge**, **20 is the shipped base look
(and the new default)**, and 40 / 60 / 100 break the mark up with the 3-noise
mix while the core stays continuous. Feather falloff ships unchanged.

The final law commit is `e8c696567`; the two rejected live attempts are
reverted (`e56941eba`, `2c5441af4`).

## The shipped laws

### Feather noise (0..100, default 20) — re-indexed

The recorded slider is the artist's scale. Two twins drive it
(`bristles.ts`):

```
featherEdgeClean(n) = smoothstep(0, 0.2, n)          // 0 at 0 -> clean edge, 1 at 20 -> base
featherNoiseDrive(n) = clamp01((n - 0.2) / 0.8)      // 0 at 20, 0.25 at 40, 0.5 at 60, 1 at 100
```

- **Slider 0 — the clean edge.** `featherShift *= uFeatherEdgeClean` removes
  the shipped Feather edge raggedness, and the extended program calms the rim's
  paper tooth to the proven F0 profile (`rimClean`). No fringe, no added noise.
- **Slider 20 — the shipped base look, the default.** The edge weight is 1 and
  the drive is 0; `featherLawActive()` returns false, so the NEUTRAL program
  renders the pre-change bytes.
- **Slider 40 / 60 / 100 — the 3-scale breakup.** The delivered law runs:

```
uN       = clamp(lateral / BRISTLE_LAYER_EDGE, 0, 1)   // 0 centre line, 1 visual edge
pen      = mix(0.88, 0.35, drive)
front    = pen + cloudMix(css) * 0.30
envelope = smoothstep(front - 0.04, front + 0.04, uN)   // softened: 4 px graded band
featherShift += uFeather * LIFT * envelope               // paint outside the front removed
featherShift += uFeather * LIFT * band * spray           // contained fringe specks
featherShift -= uFeather * LIFT * envelope * 0.90 * spike
featherShift -= uFeather * spike * reach                 // sparse peaks cancel erosion
featherShift = max(featherShift, shippedShift)          // never paint beyond the base mark
```

- `cloudMix` = THREE fixed document scales — 20 / 60 / 200 px — of a four-octave
  rotated value-noise fractal, mixed 0.40 / 0.33 / 0.27. That is the
  small/medium/high mix the artist required at 100; the uniform fine chip field
  of the rejected attempt is gone.
- Threshold-only; the paper height line is PRE's statement verbatim; gated by
  `uFeather` (Feather 0 exactly inert) and dead at the default slider 20.
- The core stays continuous at every value; the chips live in the band outside
  it and never extend past the base silhouette.

### Feather falloff (0..100, default 50)

The SHIPPED `2^(2b−1)` exponent of the rim opening (`edgeFalloffExponent` is the
single twin); `pow` is skipped when the bias is exactly 0.5. It shapes the
opening only — the noise law carries its own drive.

### The permutation (the identity mechanism)

`bristleGatherSource(extended)` is the ONE generator:

- `false` — the NEUTRAL gather: no cloud, no law uniforms, PRE statement order.
- `true` — the EXTENDED gather (the law). `gatherProgram()` compiles the four
  variants lazily on the first draw where the drive is above 0, the clean
  weight is below 1 (slider < 20), or the falloff leaves 50.

At slider 20 + falloff 50 the neutral path is selected, so the default render
is byte-identical to the pre-change baseline by construction.

## Identity vs PRE (hard gate)

At slider 20, Size 120, sheet 1080 (the new default):

| Feather | Digests (paper / transparent / white / pigment) | Baseline |
|---|---|---|
| 85 | `d4747f82 / ecfbc3d1 / 2e88a730 / 32015b19` | `v8j-base-n0-s120.json` — equal |
| 0 | `a0b8f0a5 / 6b2d3b85 / 26dc1348 / 87c7035e` | `v8j-base-f0-n0-s120.json` — equal |

The slider-20 crop is SHA-256-identical to the pre-change base crop
(`4cf10375…`). Slider 0 differs by design (`b872b55f / 4f3dabaa / b0c7c5a1 /
94083fdf`) and equals the clean F0 mark.

## The artist's anchors (Size 120, sheet 1080, Feather 85)

Crops: `/tmp/medium-engine/fn-v8j-s120-f85-n{0,20,40,60,100}-crop.png`
(and `…-f0-n{…}` for the Feather-0 control).

| Slider | State |
|---|---|
| 0 | Clean edge — no fringe, no noise (the F0 profile) |
| 20 | The shipped base look — the `110.png` appearance; byte-identical to PRE |
| 40 | Light breakup — rim chips, core at nearly full width |
| 60 | Medium — the band chips wider, the core narrows |
| 100 | Full — thin continuous core + varied chunks at the 3 cloud scales, micro-textured, contained inside the base footprint |

Six probe bars × 40 cells (sizes 4 / 40 / 120 / 200 × Feather 85 / 0 ×
0 / 20 / 40 / 60 / 100) PASS: neutral digests, slider-0 differs, twin echo,
driven states never exceed the base, clean state never falls below it, core
opening erodes progressively with a surviving spine, footprint ≥ 80 % of base,
Feather 0 inert.

## Falloff sweep (Sizes 40 / 200)

At these operands the exponent's opening change sits below the 1-px
cross-section resolution; the branch is source/unit-pinned
(`exp2(2.0 * uFeatherFalloff - 1.0)`, skip at 50). UAT row 6 is the human
arbiter of the visible spread.

## Gates

| Gate | Result |
|---|---|
| `pnpm --dir packages/efx-watercolor exec vitest run` | 44 files, **1163 passed**, 8 skipped |
| `pnpm --dir packages/efx-watercolor exec tsc --noEmit` | clean |
| `pnpm --dir packages/efx-watercolor build` | success |
| `pnpm --dir app exec tsc --noEmit` | clean |
| Affected app tests (GlobalsPanel, mediumSelection, visibility, brushGroupMedium) | 96 passed, 3 skipped |
| Slider-20 identity (Feather 85 / 0) | byte-identical to PRE |
| Probe sweep | 40 cells, six bars PASS |

## Cost

The four extended gather programs compile lazily on the first non-default
stroke (the one-time bake delta measured earlier: ~+28 ms on the first capture;
render unchanged). At slider 20 the neutral programs are reused — no compile.

## UI plumbing

- `mediums.ts`: `MediumParamKey` gains both keys; both records carry
  **20 / 50**. Eighteen medium keys.
- `params.ts` / `Engine.DEFAULT_PARAMS`: canonical `featherNoise` 20,
  `featherFalloff` 50; engine values 0.2 / 0.5.
- `aquarelleRecordState.ts`: both keys in `AQUARELLE_GLOBAL_KEYS` after
  `edgeFalloff` (twenty keys), defaults 20 / 50; the recorded bag, the
  selection allowlist and Reset inherit automatically.
- `aquarelleParamVisibility.ts`: the two rows appended in the existing `edge`
  group after Edge falloff — order: Feather, Edge transparency, Edge falloff,
  **Feather noise**, **Feather falloff**; bristle-only, existing GlobalSlider.

## The live iterations (recorded)

1. The delivered law (`82ce9df9a`) shipped the three-scale cloud + contained
   fringe + spikes, with `0..20` mapped to the plain block. The artist's live
   complaint was that slider 0 still showed the base edge fringe (the Feather
   edge) and that above 50 the micro texture was lost.
2. Attempt `84faa5aee` replaced the cloud with a single smooth erosion field —
   rejected live: the mark shrank as a smooth noodle.
3. Attempt `65caecb54` replaced it with a uniform fine chip field — rejected
   live: "looks like an animal" at 100; the artist asked for the
   small/medium/high 3-noise mix back and for the current base look to live at
   20/30, not 0.
4. `e8c696567` reverted both attempts, kept the delivered 3-scale law, added
   the re-index (0 clean / 20 base / 40–100 breakup), softened the front to
   ±0.04, floored the chips at the base silhouette, and moved the default to
   20. The artist approved live 2026-11-27.

## Honest limits

- The 100 band stays a little more connected/lacy than the artist's drawn,
  cleanly-separated chunks; the stroke ends remain the shipped caps. The artist
  approved the live look.
- The falloff's visible spread is below the cross-section resolution; row 6 is
  a live row, not a measured one.
- The old period-based constants/twins
  (`FEATHER_NOISE_FEATURES/_MIN_PX/_MAX_PX/_REFERENCE_PX/_DEPTH/_FLOOR`,
  `featherNoisePeriodPx`, `featherNoiseScale`) remain exported and unit-tested
  but are no longer read by the shipped law; a later cleanup can retire them.
- Sizes 4 / 12 resolve the document-scale cloud only coarsely; the accepted
  reading is a ragged, sparse break, never a smooth line.

## Live UAT rows (APPROVED — artist, 2026-11-27)

Surface legend: **L** live during the stroke · **S** after settle · **R** leave /
reopen + forced re-render · **U** Undo / Redo.

| # | Scenario | Expected | Surface | Status |
|---|---|---|---|---|
| 1 | Defaults (noise 20, falloff 50) at sizes 4 / 12 / 40 / 200 | Byte-identical to the shipped base — the neutral program | L S R U | PASSED (auto identity + artist) |
| 2 | Slider 0 at a fixed size | Clean edge — no fringe, no added noise | L S | PASSED (artist) |
| 3 | Slider 20 | The shipped base look — today's Feather edge, full body | L S | PASSED (auto identity + artist) |
| 4 | Sliders 40 / 60 / 100 | Progressive breakup; varied 3-scale chunks; continuous core; no smooth shrink | L S | PASSED (artist) |
| 5 | Slider 100 | Chips contained inside the base silhouette; micro texture; no animal fur / outward fibers | L S | PASSED (artist) |
| 6 | Falloff 0 / 50 / 100 at a fixed noise | The rim opening spreads / stays shipped / hugs; outer silhouette unchanged | L S | PASSED (artist; below cross-section resolution) |
| 7 | Feather 0 with both rows moved | Inert — no opening, no noise | L | PASSED (artist) |
| 8 | Pen (bristle response) and Watercolor | Pen gets the same edge; Watercolor shows no rows and renders identically | L | PASSED (artist) |
| 9 | Over a committed base / restored key | No milky halo; the merge parity holds | S R | PASSED (artist) |
| 10 | Edge transparency 100 with noise 100 | The stroke layer commits with the breakup intact (pointwise merge); the under shows through the faded band only | S R | PASSED (artist) |
| 11 | Leave/reopen + forced re-render; Undo/Redo | The bake matches the live view; the stroke undoes/redoes as one edit | R U | PASSED (artist) |
| 12 | Curved S-stroke at size 6, noise 100 | No lane/band motif; the core stays continuous | L | PASSED (artist) |

## Commits

- `82ce9df9a` — the delivered feather-noise law (front, 3-scale cloud, spikes).
- `b7e56f2b4` / `eeaca81c2` — RED/GREEN: neutral/extended permutation + the two
  UI rows (18 medium / 20 global keys).
- `3cd29a50e` — the docs record of the delivered handover.
- `65caecb54` → reverted by `e56941eba` — the rejected uniform chip attempt.
- `84faa5aee` → reverted by `2c5441af4` — the rejected smooth single-field attempt.
- `e8c696567` — the approved re-index: 0 clean, 20 base default, 3-scale
  breakup, softened front, footprint floor, defaults 20.

## Files at the end state

- `packages/efx-watercolor/src/playground/shaders.ts` — the delivered 3-scale
  cloud law + `featherEdgeClean`/`rimClean` re-index + the ±0.04 front + the
  footprint floor; neutral/extended generator.
- `packages/efx-watercolor/src/playground/bristles.ts` — `FEATHER_NOISE_NEUTRAL`
  0.2, `featherNoiseDrive`, `featherEdgeClean`, the LIFT/cloud constants.
- `packages/efx-watercolor/src/playground/Engine.ts` — the program selection
  (drive > 0 || cleanWeight < 1 || falloff ≠ 0.5), the uniform binds, default
  0.2.
- `packages/efx-watercolor/src/playground/params.ts`, `mediums.ts` — canonical
  20 / 50; eighteen medium keys.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`,
  `aquarelleParamVisibility.ts` — defaults 20 / 50; twenty global keys; the two
  `edge`-group rows.
- `probe/medium-engine/probe.ts`, `featherNoise.mjs` — the five-state sweep and
  the six bars.
- `packages/efx-watercolor/src/playground/featherNoise.test.ts`,
  `scattering.test.ts`, `params.test.ts`, `mediums.test.ts` and the four app
  test files — the re-index, default-20 and permutation pins.

## Next

- Close the quick (this record + STATE) — done by the orchestrator docs commit.
- The two in-progress skill files (`.claude/skills/efx-studio-paint/SKILL.md`,
  `references/edge-transparency.md`) remain unstaged, unchanged by this quick.
- Then the agreed next ticket: the **Density colour falloff/easing** quick.
