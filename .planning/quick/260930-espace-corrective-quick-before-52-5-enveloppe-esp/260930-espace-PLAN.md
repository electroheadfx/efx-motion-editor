---
phase: quick-260930-espace
plan: 260930-espace
type: tdd
status: complete
tasks: 3
date: 2026-09-30
---

# 260930-espace PLAN — enveloppe-espace (R8 revised: the envelope is a ROOM)

## Why

260930-dy0 native UAT 2026-09-30: **REGRESSION**. `projectWetIntoEnvelope`
was fed `snapshotWetAlpha(this.wet)` — the DEPOSIT silhouette. The deposit is
already at full pressure width, so the solver had ZERO room at any setting.
The mass the solver carries outward IS the target look (ref 144) — zeroing it
destroyed it. Max spread looks identical to min spread.

**USER DESIGN ACT 2026-09-30b — THE ENVELOPE IS A ROOM, NOT A CLIP**
(spec act on disk at `SPECS/real-paint/01-brush-footprint.md` R8 revised +
`00-overview.md` Q10 — `SPECS/` is gitignored, no spec commit):

> *"la physique doit s'appliquer sur un stroke reduit pour pouvoir
> s'appliquer sur son espace au lieu de decouper ce qui deborde
> du stroke original"*

## Contract

1. Envelope = GEOMETRIC pressure ribbon (`ribbonWithScales` at FULL pressure
   width) = the HARD maximum. Existing wet mass is grandfathered:
   room = `union(pre-solver mass, this stroke's pressure ribbon)`.
2. Deposit = footprint at REDUCED radius: `radius × (1 - g(spreadCurve))`,
   `g(0) = 0`. The solver gets room to work INSIDE the envelope.
3. Physics transports mass outward into that room. That transport IS the look.
4. Clip ONLY past the pressure ribbon (rare). NEVER clip to the deposit.
5. `featherWetEdges` stays boundary-AA only. Solver ticks stay
   `Math.ceil(spreadCurve*10)` byte-unchanged (3 at 60, 4 at 65).

- Live tier keeps the FULL radius (silhouette = the pressure envelope; live
  and finalize share it). Only the tier=final wet deposit is reduced
  (D-07: exactly one deposit feeds wet/physics).
- `g` is the UAT look lever — one form in one place (`spreadScale.depositRoom`,
  initial `g(sc) = sc`), never tuned at the engine sites.

## Tasks (TDD)

| # | Task | Files |
|---|------|-------|
| 1 | RED — room-contract pins | `core/wet-layer.envelope.test.ts` |
| 2 | GREEN — room mechanism | `core/spreadScale.ts`, `core/wet-layer.ts`, `engine/EfxPaintEngine.ts` |
| 3 | Gates + SUMMARY + STATE | battery re-run only, `.planning/quick/260930-espace-*`, `.planning/STATE.md` |

## must_haves

- Envelope = geometric pressure ribbon ∪ existing mass — never the deposit
- Deposit radius reduced by `g(spreadCurve)` at the tier=final deposit only
- Room mass survives projection (never-clip-to-deposit — the anti-dy0 pin)
- Past-ribbon mass clipped (rare)
- Existing out-of-ribbon mass grandfathered (multi-stroke safety)
- `featherWetEdges` boundary-AA byte-unchanged
- `Math.ceil(spreadCurve * 10)` x2 byte-unchanged
- Margin formula byte-unchanged
- Battery laws at EXISTING bounds, zero bound edits
- 260929-t2o capsule-sweep contract untouched (paint.ts / stroke.ts /
  footprintLanes.ts algorithms untouched — the radius change is at the engine
  call site)

## key_links

- snapshot ∪ ribbon BEFORE the solver, projection strictly AFTER (both sites)
- the deposit curve and the envelope curve share the same smooth+resample so
  the ribbon always contains the deposit
- `g` lives only in `spreadScale.depositRoom`
- G6 raw-read `DEPOSIT_KEEP_TIER = 70` byte-identical
- STOP-and-report on any law-vs-look conflict (never retune a bound)

## threat model

| ID | Threat | Mitigation |
|----|--------|------------|
| T-esp-01 | Envelope swapped to ribbon alone clips earlier strokes | room = union(pre-solver mass, ribbon); `existing-mass-kept` pin |
| T-esp-02 | `g` too aggressive → solver cannot fill the room → stroke too thin | `g` is the named UAT look lever; initial `g(sc) = sc`; tune at UAT |
| T-esp-03 | Live/final silhouette divergence | live keeps FULL radius (the envelope); only tier=final deposit is reduced |
| T-esp-04 | Envelope ribbon does not contain the reduced deposit | same smooth+resample curve, deposit at `brushR*(1-g)`, ribbon at `brushR` |
| T-esp-05 | Footprint raster reopened (t2o lock) | radius is a call-site parameter; paint.ts / stroke.ts / footprintLanes.ts untouched |
| T-esp-06 | Ticks or margin retuned to hold the width | law pins `ticks-unchanged` / `margin-formula` green at base and after |
