---
phase: quick-260930-libre
plan: 260930-libre
type: tdd
status: complete
tasks: 3
date: 2026-09-30
---

# 260930-libre PLAN — physique-libre (R8 revised: physics on a reduced clone, NO masking)

## Why

260930-espace native UAT 2026-09-30: **REGRESSION (still)**. The reduced
deposit clone is CORRECT and stays. What still kills the look is
`projectWetIntoEnvelope`, which (a) zeros every pixel the solver carried past
the ribbon — that IS the edge physics we must keep — and (b) renormalizes the
escaped mass onto the interior as a uniform gain (`alpha_i × (1 + E/S)`),
washing the texture into a saturated flat. Same "effects cut to fit the
thickness" defect as dy0.

**USER DESIGN ACT 2026-09-30c — PHYSICS ON A REDUCED CLONE, NO MASKING**
(spec act on disk at `SPECS/real-paint/01-brush-footprint.md` R8 revised +
`00-overview.md` Q10 — `SPECS/` is gitignored, no spec commit):

> *"calculer la physique sur un clone du stroke qui a une reduction de
> la size ... le stroke original pourra servir pour appliquer d'autres
> effets plus tard et ignore ou un garde fou"*

> *"instead of cutting/truncating it by masking"*

## Contract

1. Physics clone = the ONLY deposit the solver sees, at
   `size × (1 - depositRoom(spreadCurve))`. The solver runs UNCONSTRAINED —
   its outward transport is the edge physics.
2. Original stroke = the pressure geometry (8c thickness field). PRESERVED as
   the gesture record (260924-stb). Ignored by physics for now; later effects
   (granulation role 4, pigment mixing spec 03) or a SOFT guardrail may use it.
3. ZERO masking: `snapshotWetAlpha`, `projectWetIntoEnvelope`,
   `stampRibbonIntoEnvelope` and their pins are DELETED. Never clip to the
   deposit, never clip to the ribbon, never renormalize.
4. "2x thinner (à estimer)" = `depositRoom` reaches ~0.5 at the working spread
   65 and returns to 0 at rest (spread 0 still reads pressure width, matching
   the fullR live preview). `depositRoom` is the ONE look lever.

- Kept: `featherWetEdges` boundary-AA only (the solver supplies the organic
  edge now); solver ticks `Math.ceil(spreadCurve*10)` byte-unchanged (3 at 60,
  4 at 65); 260929-t2o footprint raster LOCKED.
- Accepted tradeoff: pressure width is no longer a HARD ceiling — the
  reduction factor aims at it and high spread may overshoot slightly. That is
  the price of not cutting the edge physics. If a ceiling is ever required it
  must be a soft outward fade, never a cut.

## Tasks (TDD)

| # | Task | Files |
|---|------|-------|
| 1 | RED — free-physics pins (masking pins deleted) | `core/wet-layer.libre.test.ts` (replaces `core/wet-layer.envelope.test.ts`) |
| 2 | GREEN — delete masking, unconstrained solver, `g(65) ≈ 0.5` | `core/spreadScale.ts`, `core/wet-layer.ts`, `engine/EfxPaintEngine.ts` |
| 3 | Gates + SUMMARY + STATE | battery re-run only, `.planning/quick/260930-libre-*`, `.planning/STATE.md` |

## must_haves

- Physics sees ONLY the reduced clone (`size: depositR` at both tier=final sites)
- Solver runs UNCONSTRAINED — zero clipping at wet/physics
- `snapshotWetAlpha` / `projectWetIntoEnvelope` / `stampRibbonIntoEnvelope`
  deleted from `wet-layer.ts` AND their pins deleted
- `active.envelope` field gone; the engine never reads/writes an envelope
- `depositRoom(0) = 0`; `depositRoom(spreadCurveFor(65)) ≈ 0.5` (2x thinner);
  never exceeds 0.5 (the deposit never inverts)
- Live tier keeps FULL radius (spread 0 reads pressure width, matches the
  fullR live preview)
- `featherWetEdges` boundary-AA byte-unchanged
- `Math.ceil(spreadCurve * 10)` x2 byte-unchanged
- Margin formula byte-unchanged
- Battery laws at EXISTING bounds, zero bound edits
- 260929-t2o capsule-sweep contract untouched (paint.ts / stroke.ts /
  footprintLanes.ts algorithms untouched — the radius change is at the engine
  call site)

## key_links

- The reduced deposit is the ONLY `renderPaintStroke` tier=final input (D-07:
  exactly one deposit feeds wet/physics)
- `g` lives only in `spreadScale.depositRoom` — one form, one place
- G6 raw-read `DEPOSIT_KEEP_TIER = 70` byte-identical
- STOP-and-report on any law-vs-look conflict (never retune a bound)

## threat model

| ID | Threat | Mitigation |
|----|--------|------------|
| T-lib-01 | Masking survives in a helper or comment-only form (soft-clip elsewhere) | source-count pins at 0 for all three call names; exports `undefined` |
| T-lib-02 | `g` too small → solver cannot fill toward pressure width → thin stroke | `g(65) ≈ 0.5` is the contract (2x thinner, à estimer); `depositRoom` is the named UAT look lever |
| T-lib-03 | `g` too large → deposit inverts / vanishes | `g <= 0.5` pin — the deposit is never thinner than half |
| T-lib-04 | Live/final silhouette confusion at rest | live keeps FULL radius; `g(0) = 0` so the final deposit is full pressure width at spread 0 |
| T-lib-05 | Footprint raster reopened (t2o lock) | radius is a call-site parameter; paint.ts / stroke.ts / footprintLanes.ts untouched |
| T-lib-06 | Ticks or margin retuned to hold a width | law pins `ticks-unchanged` / `margin-formula` green at base and after |
| T-lib-07 | Someone re-adds a hard ceiling later "to clean up bleed" | the spec act names the accepted overshoot; any ceiling must be a soft outward fade, never a cut |
