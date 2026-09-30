---
phase: quick-260930-detail
plan: 260930-detail
type: tdd
status: planned
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-detail PLAN — shape-detail (R10: fractal brush-shape noise)

**AUTOMATED-READY target.** Acceptance is the user's live native UAT (the 4
R10 rows). Nothing is done until that UAT passes.

## Why (RE-UAT INPUT, defect 2)

Shape detail slider is wired to nothing on paint. User ask: fractal noise on
the BRUSH SHAPE (deforms the outline, not the pixels), following the stroke
shape and modulated by PRESSION and VELOCITY (image 154).

Root cause (code, verified): `opts.edgeDetail` → `variance = (1.5 +
sqrt(radius)*0.9) * edgeMul` is computed at `paint.ts:521/555/605` but used
ONLY to pad `curveBounds` — never passed to `drawBristleFootprint` (the
`paint.ts:416` doc's `ribbonWithScales → deformNScaled` step was dropped in
the R7 capsule-sweep rework). `erase.ts:66-78` still has the live pattern —
that is why it works on erase and not on paint. `util/math.ts:13 gauss` is
unseeded `Math.random` (breaks held-pose determinism). Default `edgeDetail
4` → `edgeMul 0.08` ≈ invisible (v11 `radius*0.25 ≈ edgeMul 1`).

## The contract (spec act 01-brush-footprint.md R10 + R8 scope note)

1. Re-seed gauss on traceSeed (deterministic deform draws).
2. `deformNScaled` wired into `drawBristleFootprint`'s ribbon contour —
   `variance` reaches the drawn outline (not just bounds padding).
3. Velocity coupling via `speedAtT` / `PenPoint.spd` (pulled forward from
   52.5 R2/R3): amplitude rises with spd.
4. `edgeDetail` default 4 → 50 (`edgeMul = value/50`, à estimer at UAT).

R8 scope note CONFIRMED at this quick's start: source-shape geometry is NOT
bound by pressure-max-width (image-154 spills outside the pressure ribbon by
design); R8 governs physics/spread growth only.

Look-continuity law (R9's amplitude-not-presence here): slider bottom =
finer/harder torn edge of the SAME process — the deform pipeline always runs
(variance 0 = identity displacement), never a different rendering.

Out of scope (do NOT fold in): gesture coupling on physics/spread (52.5
R2/R3), granulation (52.6), kmerp (52.7).

## Design (t2o LOCKED — the deform displaces frames, never the raster)

| File | Change |
|------|--------|
| `util/math.ts` | `gauss(mean, stddev, rng = Math.random)` — Box-Muller draws from the injected rng (default preserves battery byte-behavior) |
| `util/traceSeed.ts` | `seededRng(strokeSeed, streamKey): () => number` — mulberry32 from `avalanche(fnv1a(...))`; the deform's ONLY randomness source |
| `brush/stroke.ts` | `deformScaled` / `deformNScaled` gain optional `rng` (pass-through to `gauss`; default = legacy). NEW `deformSampleSides(...)`: `ribbonWithScales → deformNScaled` (the named wiring) + fold of the deformed chains' per-segment bulges onto the per-sample lateral side offsets (`leftOff/rightOff`), × velocity `clamp(1 + speedAtT(curve,t)*0.003, 1, 1.5)` |
| `brush/paint.ts` | `FootprintParams` gains `variance?: number`. `drawBristleFootprint` calls `deformSampleSides` (ALWAYS — variance 0 = identity) with `seededRng(hashMutationId(mutationId), 'shape-detail')` and shifts `geom[si]` by the side-offset centre + re-derives `halfWs[si]` from the side-offset width. The three sites (528/562/615) pass `variance` in params. Capsule/subpath/fill structure untouched |
| `brush/erase.ts` | per-layer `deformNScaled`/`deformScaled` draws seeded (`seededRng(hashMutationId(mutationId), 'erase-shape')`); `mutationId?: number` param added |
| `engine/EfxPaintEngine.ts` | `edgeDetail: 4` → `50`; erase call passes `mutationId` |
| `app/.../physicsPaintStudioSettings.ts` | default `edgeDetail: 4` → `50` |

Containment law: at variance 0 the existing pin stays green unchanged
(harness passes no variance). The deformed containment is pinned NEW in
`shapeDetail.test.ts` against the displaced frames.

## Battery contract (zero bound edits, harness files byte-untouched)

- `gauss`'s default rng stays `Math.random` → the three engine-mirrored
  harnesses (they stub `Math.random` with an LCG) are byte-identical.
- `physicsWidthScaling`'s `ENGINE_EDGE_DETAIL = 4` stays as its FIXED
  measurement condition (bounds calibrated once — never re-calibrated);
  the engine default is now 50. Re-mirroring would be a new VERDICT cycle.
- t2o pins (`paint.bristleSeed.test.ts`) stay green: subpath count
  `curve.length - 1`, one fill, containment (variance-0 harness), rim/Poisson
  widths, determinism ABA (now stronger — seeded rng).

## must_haves

1. `gauss` consumes an injected rng; `seededRng` deterministic per
   (strokeSeed, streamKey), differing across stream keys.
2. `drawBristleFootprint` deforms the ribbon contour with `deformNScaled`
   (via `deformSampleSides`) at EVERY variance including 0 (presence).
3. `variance` is a `FootprintParams` field passed at all three paint sites;
   vertex displacement grows with `variance` (amplitude).
4. Displacement scales with local width (260927-ton, inside `deformScaled`)
   and with velocity (`speedAtT` factor in `1 .. 1.5`).
5. Held pose: same mutationId + curve + variance → byte-identical logs;
   different mutationId → different.
6. Zero `Math.random` in `paint.ts` / `erase.ts` / `stroke.ts`;
   `seededRng(` in `paint.ts` and `erase.ts`.
7. `edgeDetail` default 50 at engine AND app settings.
8. Capsule-sweep structure pins byte-green (one capsule per short step, one
   fill per fibre, lane layout, widths in `[WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH]`).
9. Battery files, `fluids.ts`, `wet-layer.ts`, footprint lane algorithms
   (`footprintLanes.ts`), ROADMAP, manifests: zero edits.

## Threat model

| ID | Threat | Mitigation |
|----|--------|------------|
| T-det-01 | unseeded gauss survives in the deform path | source pins at zero `Math.random` in the three deform files; `seededRng(` wired at paint + erase |
| T-det-02 | held-pose replay drifts | ABA byte-identical pin (same mutationId twice) |
| T-det-03 | erase re-lands on the painted mark | erase draws its own stream (`'erase-shape'`) + its own mutationId (R4) |
| T-t2o-01 | the deform reopens the capsule raster | frames-only displacement; subpath/one-fill pins green at variance 20 |
| T-t2o-02 | variance-0 changes today's look (family switch) | look-continuity pin: variance 0 = identity displacement, same pipeline |
| T-amp-01 | amplitude flat in pressure/width | 260927-ton sMid law stays inside `deformScaled` (battery-pinned) |
| T-amp-02 | amplitude flat in velocity | velocity pin: same geometry, spd 0 vs 300 → deviation grows |
| T-amp-03 | default still invisible | default-50 pins (engine + app) |
| T-r8-01 | someone clips the deform to the pressure ribbon | R8 scope note in spec; the deform is upstream of physics and never masked |
| T-bat-01 | battery bounds move | default rng preserved; harness files byte-untouched (scope guard) |

## key_links

- Law: `SPECS/real-paint/01-brush-footprint.md` R10 + R8 scope note
  (on disk — `SPECS/` is gitignored, no spec commit).
- Recovered reference: `SPECS/watercolor-studio-v11.html` deform/deformN
  (~261-267, usage ~476-521) — already recovered as `deformNScaled` /
  `deformScaled` (`brush/stroke.ts`, 260927-ton).
- Live pattern: `brush/erase.ts:66-78`. Target sites: `brush/paint.ts:528,
  562, 615` + `drawBristleFootprint` (`paint.ts:142`).
