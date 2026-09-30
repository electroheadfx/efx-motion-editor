---
phase: quick-260930-detail
plan: 260930-detail
type: tdd
status: complete
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-detail SUMMARY — shape-detail (R10: fractal brush-shape noise)

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT (the
4 R10 rows). Nothing is done until that UAT passes.

## Why (RE-UAT INPUT, defect 2)

Shape detail slider was wired to nothing on paint. User ask: fractal noise on
the BRUSH SHAPE (deforms the outline, not the pixels), following the stroke
shape and modulated by PRESSION and VELOCITY (image 154).

Root cause (code, verified): `opts.edgeDetail` → `variance = (1.5 +
sqrt(radius)*0.9) * edgeMul` was computed at `paint.ts:521/555/605` but used
ONLY to pad `curveBounds` — never passed to `drawBristleFootprint` (the
`paint.ts:416` doc's `ribbonWithScales → deformNScaled` step was dropped in
the R7 capsule-sweep rework). `erase.ts:66-78` kept the live pattern — that
is why it worked on erase and not on paint. `util/math.ts:13 gauss` was
unseeded `Math.random` (breaking held-pose determinism). Default
`edgeDetail: 4` → `edgeMul 0.08` ≈ invisible (v11 `radius*0.25 ≈ edgeMul 1`).

## The contract (spec act 01-brush-footprint.md R10 + R8 scope note)

1. **Re-seed gauss on traceSeed** — `gauss(mean, stddev, rng = Math.random)`;
   `traceSeed.seededRng(strokeSeed, streamKey)` (mulberry32) is the deform
   path's ONLY randomness source. Erase draws its own stream
   (`'erase-shape'`) so the pattern never aligns with the erased mark (R4).
2. **`deformNScaled` wired into `drawBristleFootprint`'s ribbon contour** —
   `variance` is a `FootprintParams` field passed at all three paint sites
   and reaches the drawn outline. New `deformSampleSides` (`brush/stroke.ts`)
   runs the deformNScaled midpoint law on the ribbonWithScales polygon
   (`gauss(0, variance * sMid)` = the 260927-ton local-width amplitude,
   octave decay `1/(1+d*0.65)` = v11) and folds the deformed chains onto the
   capsule lattice: per sample, the mean perpendicular deviation of the
   inserted contour vertices in the two adjacent chain segments → centre
   shift `(uL - uR)/2` + half-width delta `(uL + uR)/2`.
3. **Velocity coupling** via `speedAtT` / `PenPoint.spd` (pulled forward from
   52.5 R2/R3): amplitude × `clamp(1 + spd*0.003, 1, 1.5)` (the existing
   speed law).
4. **Default rebased** `edgeDetail` 4 → 50 at the engine AND app settings
   (`edgeMul = value/50`; v11 `radius*0.25 ≈ edgeMul 1`, à estimer at UAT).

**R8 scope note CONFIRMED at this quick's start** (recorded in spec 01 R8):
source-shape geometry is NOT bound by pressure-max-width — image-154 noise
spills OUTSIDE the pressure ribbon by design; R8 governs physics/spread
growth only.

**Look-continuity law** (R9's amplitude-not-presence here): the deform
pipeline ALWAYS runs — variance 0 = identity displacement, never a different
rendering.

## What landed

| File | Change |
|------|--------|
| `util/math.ts` | `gauss(..., rng = Math.random)` — Box-Muller draws from the injected rng (default preserves battery byte-behavior) |
| `util/traceSeed.ts` | `seededRng(strokeSeed, streamKey)` — mulberry32; the deform's only randomness source |
| `brush/stroke.ts` | `deformScaled` / `deformNScaled` gain optional `rng` (pass-through); NEW `deformSampleSides` (the named wiring + fold + velocity) |
| `brush/paint.ts` | `FootprintParams.variance?`; `drawBristleFootprint` runs `deformSampleSides` unconditionally (frames-only displacement — capsule raster untouched); all three sites pass `variance` |
| `brush/erase.ts` | seeded deform draws (`seededRng(hashMutationId(mutationId), 'erase-shape')`); `mutationId?` param |
| `engine/EfxPaintEngine.ts` | `edgeDetail: 50`; erase call passes `activeMutationId ?? lastCompletedMutationId` |
| `app/.../physicsPaintStudioSettings.ts` | default `edgeDetail: 50` |

Commits: `7a903711` (plan) → `78eaa49a` (RED) → GREEN → docs close.

## Pins (10)

| Pin | Role | RED assertion at base |
|-----|------|----------------------|
| `gauss-draws-from-rng` | gauss consumes the injected rng (2 Box-Muller draws) | `expected 0 to be 2` |
| `seededRng-on-traceSeed` | seededRng deterministic per (seed, stream); streams differ | `expected 'undefined' to be 'function'` |
| `deform-wired-into-footprint` | `deformSampleSides(` x1 in paint; `variance?: number` in FootprintParams | `expected 0 to be 1` |
| `variance-scales-amplitude` | variance 20 run ≠ variance 0 run (variance reaches the outline) | logs identical |
| `velocity-scales-amplitude` | spd 300 run ≠ spd 0 run; lateral extent grows | logs identical |
| `look-continuity-presence` | no `if (variance` gate; variance 0 = identity extent | green at base |
| `deform-draws-seeded` | `seededRng(` in paint + erase | `expected 0 to be 1` |
| `default-50` | engine + app `edgeDetail: 50` | toContain fails (it is 4) |
| `held-pose-byte-identical` | same mutationId + curve + variance → identical logs (stop-motion law) | green at base |
| `unseeded-deform-absent` | zero `Math.random()` in paint / erase / stroke | green at base |

## Gates (all green, bounds unchanged)

- **RED** (`78eaa49a`): 10 tests / 7 failed / 3 passed — all failures
  AssertionError (0 crashes, 0 TypeErrors); evidence:
  `260930-detail-RED-EVIDENCE.json`.
- **GREEN**: shapeDetail 10/10 + `paint.bristleSeed.test.ts` 26/26 (the
  full t2o capsule-sweep battery byte-green: subpath count `curve.length-1`,
  one fill, containment at the variance-0 harness, rim/Poisson widths,
  determinism ABA).
- **Full package suite**: 35 files / 277 passed | 3 pre-existing skips
  (battery re-ran UNCHANGED).
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: only `math.ts`, `traceSeed.ts`, `stroke.ts`, `paint.ts`,
  `erase.ts`, `EfxPaintEngine.ts`, `physicsPaintStudioSettings.ts` + quick
  docs. Battery / `footprintLanes.ts` / `fluids.ts` / `wet-layer.ts` /
  `spreadScale.ts` / ROADMAP / manifests: zero edits.
- **Law preservation (zero bound edits)**: PIN 0 `[0.99, 1.01]`, PIN 0b
  `>= 0.95`, DEPOSIT_KEEP_TIER 70, DRY_ALPHA_THRESHOLD 1, LIVE_TIER_DIVISOR
  4, LIVE_WIDTH_MUL 4, STREAK_ALPHA 0.55, WIDTH_FLOOR 0.5, RIM_WIDTH_MIN
  1.0, CORE_MAX_TRACE_WIDTH 2, BODY_WIDTH_MIN 1.4, density ratio `>= 1.5`,
  SIZE excursion `<= 0.35`, gauge `<= 10%`, ink `+/- 15%`, spread curve
  260925-b7c, tick floor (R9) — all at EXISTING values. STOP rule: **not
  triggered**.
- **Battery contract**: `gauss`'s default rng stays `Math.random` (the three
  engine-mirrored harnesses stub it with an LCG → byte-identical).
  `physicsWidthScaling`'s `ENGINE_EDGE_DETAIL = 4` stays as its FIXED
  measurement condition (bounds calibrated once — never re-calibrated); the
  engine default is now 50. Re-mirroring would be a new VERDICT cycle.
- 260929-t2o capsule-sweep contract LOCKED — the deform displaces
  per-sample frames only; the raster structure (one convex capsule per short
  step, one fill per fibre, continuous lane field) is untouched.
- Out of scope, not folded in: gesture coupling on physics/spread (52.5
  R2/R3), granulation (52.6), kmerp (52.7). ROADMAP untouched; no
  `verify_phase_goal` / `update_roadmap`; no installs; no push; no dev
  server; `vitest run` only.

## Native UAT rows — PENDING (the user's eye)

- [ ] **Slider bottom = finer/harder torn edge, not a different rendering**
      (look-continuity law)
- [ ] **Fractal follows the stroke shape** (arc-space, not pixel noise)
- [ ] **Amplitude tracks width/pressure and velocity** (fast stroke = more
      torn edge)
- [ ] **Held pose replays byte-identical**
- [ ] `edgeDetail` default judged (50 ≈ v11 `radius*0.25` — *à estimer*;
      too strong → reduce toward 35-40; too subtle → raise)
- [ ] 260930-continuity + libre + t2o + 52.4 rows still standing

Note: the dy0 (`3ea4e5f8..32242ccb`), espace (`71fa8521..4917b5a6`),
libre (`b61c1b82..a502010d`), continuity (`0814e720..0de2fb2d`) and this
series stay LOCAL until the look is back — the user pushes.
