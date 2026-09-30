---
phase: quick-260930-continuity
plan: 260930-continuity
type: tdd
status: planned
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-continuity PLAN — spread-continuity (R9: solver-tick floor)

**AUTOMATED-READY target.** Acceptance is the user's live native UAT: below-50
reads "the same look, finer, harder" (small tight relief, not chalk) and
spread 60-65 is byte-identical to the approved look. Nothing is done until
that UAT passes.

## Why (RE-UAT INPUT, defect 1)

Below Spread 50 renders chalky (images 152/153). User ask: *"below 50 should
read the SAME look as above 60, but finer and harder"* — the idea is CORRECT
and is the law: **a look lever scales the AMPLITUDE of one always-on process,
never its presence.**

Root cause (arithmetic, verified): `physicsTicks = max(1, ceil(spreadCurve*10))`.
`spreadCurveFor(50) = 0.09` → 0.9 → ceil = 1. So ticks = 1 for every spread
≤ 50 and 2 at 51–56, versus 3 at 60 and 4 at 62+. One solver tick = no mass
transport = the raw footprint grain is exposed as chalk. The painterly relief
IS that transport.

Deeper cause: `spreadCurveFor` (approved law 260925-b7c) compresses slider
0–50 into only 9% of the curve, so every sc-indexed lever is near-dead below
50. The regime boundary is hidden there.

## The contract (spec act 01-brush-footprint.md R9, landed first)

1. Move the tick law into `spreadScale.ts` next to `depositRoom` (one lever,
   one place): `physicsTicks(spreadCurve) = max(TICK_FLOOR, ceil(spreadCurve*10))`.
2. `TICK_FLOOR = 3` (à estimer / judged at UAT).
3. PROVABLY ZERO EFFECT on the approved range: the floor 3 sits at or below
   the current 60–65 values (3 and 4), so spread 60–65 must be
   BYTE-IDENTICAL (tick counts 3 at 60–61, 4 at 62–65).
4. DO NOT touch `spreadCurveFor` (260925-b7c LOCKED — reshaping it would move
   the working 60–65 range).

Tradeoff (recorded): the floor makes 0–55 homogeneous in CHARACTER but flat
in AMOUNT (no tick grading across the compressed band). The 260925-b7c
"new 50 = old 30" tick-level look-equality is superseded — at 50 the engine
used to be "by design a hard stamp", and that IS the chalk. The curve law
itself is untouched.

## Production diff (2 files)

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/core/spreadScale.ts` | add `TICK_FLOOR = 3` + `physicsTicks` (the law, next to `depositRoom`); `spreadCurveFor` byte-identical |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | both `Math.max(1, Math.ceil(spreadCurve * 10))` sites → `physicsTicks(spreadCurve)` (import added to the existing spreadScale import line) |

Tests: `spreadScale.ticks.test.ts` (NEW — R9 floor pins),
`wet-layer.libre.test.ts` (the `ticks-unchanged` wiring pin reworked to
`ticks-law-wired`).

## Battery contract (zero bound edits, harness files byte-untouched)

- `spreadScale.test.ts` (260925-b7c curve law) byte-untouched — its
  `legacyTicks` is the legacy reference for the curve calibration pins
  (self-referential on `0.09`); the curve law is not in scope here.
- `physicsSettledFootprint` / `physicsWidthScaling` /
  `productionAaSettleMeasurement` compute `K` locally as a FIXED measurement
  condition (K=1 at Spread 50; W2/W6 texture gates at Spread 80 → 7 ticks,
  floor-immune). Bounds were calibrated ONCE and must NEVER be re-calibrated —
  the harness files stay byte-unchanged (scope guard). Their "engine default
  K=1" comments document the pre-floor law as the measurement condition; the
  engine law is now `physicsTicks`. Re-mirroring the harnesses to the new law
  would be a new VERDICT calibration cycle — NOT this quick.
- W2/W6 ("texture present when spread is engaged") bounds stay (they assert
  at 80). R9 supersedes only the premise "K=1 at 50 is by design a hard
  stamp" — no bound forbids texture at 50. No law-vs-look conflict.

## must_haves

1. `physicsTicks` exported from `spreadScale.ts`; `TICK_FLOOR === 3`.
2. `physicsTicks(0) === physicsTicks(spreadCurveFor(50)) ===
   physicsTicks(spreadCurveFor(55)) === 3` (was 1 / 1 / 2 — the chalk band).
3. `physicsTicks(spreadCurveFor(60)) === 3` and
   `physicsTicks(spreadCurveFor(65)) === 4` — byte-identical to the pre-floor
   law on the approved range.
4. `physicsTicks(sc) >= max(1, ceil(sc*10))` for every slider cell — the
   floor only RAISES (never reduce ticks to hold a width).
5. `physicsTicks(` at the engine exactly 2; `Math.ceil(spreadCurve * 10)` at
   the engine exactly 0 (the law moved out).
6. `spreadCurveFor` byte-identical (260925-b7c pins green unchanged).
7. Battery files, footprint files (`paint.ts` / `footprintLanes.ts` /
   `stroke.ts`), `fluids.ts`, `wet-layer.ts`, ROADMAP, manifests: zero edits.
8. All battery law bounds at EXISTING values (PIN 0 [0.99, 1.01], PIN 0b
   ≥ 0.95, DEPOSIT_KEEP_TIER 70, DRY_ALPHA_THRESHOLD 1, W1–W7, WIDTH_FLOOR
   0.5 / rim ≥ 1 px / CORE_MAX_TRACE_WIDTH = 2, density ≥ 1.5, SIZE ≤ 0.35,
   gauge ≤ 10%, ink ±15%, live divisor 4, spread curve 260925-b7c).

## Threat model

| ID | Threat | Mitigation |
|----|--------|------------|
| T-con-01 | floor too low (still chalk below 50) | `TICK_FLOOR` is the one UAT lever (à estimer); raise in `spreadScale.ts` only |
| T-con-02 | floor moves the approved 60–65 look | floor 3 ≤ 3 at 60–61 and ≤ 4 at 62–65 — identity pins assert 3@60 / 4@65 |
| T-con-03 | someone reshapes `spreadCurveFor` to "fix" the band | 260925-b7c LOCKED — the four curve pins stay byte-green; the act names the compression as the accepted cause |
| T-con-04 | tick law re-inlined at the engine | wiring pin: `physicsTicks(` ×2 and `Math.ceil(spreadCurve * 10)` ×0 |
| T-con-05 | a "reduction" sneaks in to hold a width | never-reduces pin: `physicsTicks >= max(1, ceil(sc*10))` at every 0.5-step |
| T-con-06 | battery bounds silently retuned | scope guard: battery files byte-untouched; bounds greps at existing values |
| T-con-07 | floor raises low-end ticks and violates a settle bound when the harness is re-mirrored | out of scope (harness files untouched); if a future re-mirror hits a bound, STOP-and-report — never re-calibrate |

## key_links

- Law: `SPECS/real-paint/01-brush-footprint.md` R9 (on disk — `SPECS/` is
  gitignored, no spec commit) + R8 kept-line amendment + acceptance rows +
  prohibitions + Interview Log round 23.
- Lever: `packages/efx-physic-paint/src/core/spreadScale.ts`.
- Sites: `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` (both
  `Math.max(1, Math.ceil(spreadCurve * 10))` occurrences).
