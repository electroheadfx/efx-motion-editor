---
phase: quick-260930-continuity
plan: 260930-continuity
type: tdd
status: complete
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-continuity SUMMARY — spread-continuity (R9: solver-tick floor)

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT:
below-50 reads "the same look, finer, harder" (small tight relief, not chalk)
and spread 60-65 is byte-identical to the approved look. Nothing is done
until that UAT passes.

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

1. Tick law moved into `spreadScale.ts` next to `depositRoom` (one lever, one
   place): `physicsTicks(spreadCurve) = max(TICK_FLOOR, ceil(spreadCurve*10))`.
2. `TICK_FLOOR = 3` (à estimer / judged at UAT).
3. PROVABLY ZERO EFFECT on the approved range: the floor 3 sits at or below
   the current 60–65 values (3 at 60–61, 4 at 62–65), so spread 60–65 is
   byte-identical.
4. `spreadCurveFor` NOT touched (260925-b7c LOCKED — reshaping it would move
   the working 60–65 range).

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/core/spreadScale.ts` | `TICK_FLOOR = 3` + `physicsTicks` next to `depositRoom`; `spreadCurveFor` byte-identical |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | both `Math.max(1, Math.ceil(spreadCurve * 10))` sites → `physicsTicks(spreadCurve)` (existing import line) |
| `packages/efx-physic-paint/src/core/spreadScale.ticks.test.ts` | NEW — 6 R9 pins |
| `packages/efx-physic-paint/src/core/wet-layer.libre.test.ts` | `ticks-unchanged` reworked → `ticks-law-wired` (the "1 at 50" assertion documented the chalk defect and is superseded) |

Commits: `0814e720` (plan) → `aa94b88d` (RED) → `71641844` (GREEN) → docs close.

## Implementation contract

**Amplitude, not presence.** The solver runs at every spread — the slider
grades amount above the floor. `physicsTicks` is the ONLY tick form; both
engine sites call it (`physicsTicks(` ×2, inline formula ×0).

**Floor arithmetic (verified):** pre-floor 1 tick at slider 0–50, 2 at 51–56,
3 at 57–61, 4 at 62–64, 4+ at 65+. With `TICK_FLOOR = 3`: 3 at 0–61 (the
chalk band and the 2-tick band both lift to 3), unchanged at 62+. The
"finer and harder" at 0–55 comes from 3 tight ticks on a fuller-width deposit
(`depositRoom` still grades g and the margin still grades the compute window)
versus the looser 3–4-tick relief on a thinner deposit at 60–65.

## Pins (7)

| Pin | Role | RED assertion at base |
|-----|------|----------------------|
| `tick-floor-lever` | `physicsTicks` exported; `TICK_FLOOR = 3` | `expected 'undefined' to be 'function'` |
| `chalk-floor` | 0 / 50 / 55 all run `TICK_FLOOR` ticks (was 1 / 1 / 2) | same |
| `approved-range-identical` | 60 → 3 and 65 → 4 (byte-identical to the pre-floor law) | same |
| `never-reduces` | `physicsTicks >= max(1, ceil(sc*10))` at every slider cell | same |
| `floor-band` | every pre-floor cell ≤ `TICK_FLOOR` runs exactly `TICK_FLOOR` (0–61 → 3) | same |
| `monotone` | non-decreasing across slider 0..100 | same |
| `ticks-law-wired` | `physicsTicks(` ×2 at the engine; `Math.ceil(spreadCurve * 10)` ×0 | `expected +0 to be 2` |

## Gates (all green, bounds unchanged)

- **RED** (`aa94b88d`): 18 tests / 7 failed / 11 passed — all failures
  AssertionError (0 crashes, 0 TypeErrors — every target pin fails on its
  first typeof/count assertion); evidence:
  `260930-continuity-RED-EVIDENCE.json`.
- **GREEN** (`71641844`): both pin files 18/18.
- **Full package suite**: 34 files / 267 passed | 3 pre-existing skips
  (battery files re-ran UNCHANGED: physicsSettledFootprint,
  physicsWidthScaling, productionAaSettleMeasurement,
  depositGateFieldMeasurement, drying.continuity, paint.bristleSeed,
  paint.depositSourceShape).
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: the `260930-continuity` commit series touches ONLY
  `spreadScale.ts`, `EfxPaintEngine.ts`, `spreadScale.ticks.test.ts` (new),
  `wet-layer.libre.test.ts` + `.planning/quick/260930-continuity-*`.
  Battery files, `spreadScale.test.ts` (260925-b7c), `fluids.ts`,
  `wet-layer.ts`, footprint files, ROADMAP, manifests all absent.
  Locked/battery diff = 0 lines.
- **Law preservation (zero bound edits)**: PIN 0 composite `[0.99, 1.01]`,
  PIN 0b `>= 0.95`, DEPOSIT_KEEP_TIER 70, DRY_ALPHA_THRESHOLD 1,
  LIVE_TIER_DIVISOR 4, LIVE_WIDTH_MUL 4, STREAK_ALPHA 0.55, WIDTH_FLOOR 0.5,
  RIM_WIDTH_MIN 1.0, CORE_MAX_TRACE_WIDTH 2, BODY_WIDTH_MIN 1.4, density
  ratio `>= 1.5`, SIZE excursion `<= 0.35`, gauge `<= 10%`, ink `+/- 15%`,
  spread curve 260925-b7c (`spreadCurveFor` byte-identical — its 4 pins
  green unchanged). STOP rule: **not triggered** — no law-vs-look conflict
  (W2/W6 assert at Spread 80 → 7 ticks, floor-immune; no bound forbids
  texture at 50 — R9 only revokes the "K=1 at 50 is by design a hard stamp"
  premise, which IS the chalk).
- **Battery contract**: the three engine-mirrored harnesses compute K locally
  as a FIXED measurement condition (K=1 at Spread 50) and stay
  byte-unchanged — their bounds were calibrated ONCE and must never be
  re-calibrated. Re-mirroring them to `physicsTicks` would be a new VERDICT
  calibration cycle, NOT this quick. Their "engine default K=1" comments
  document the pre-floor law as the measurement condition.
- ROADMAP untouched; `verify_phase_goal` / `update_roadmap` not run; no
  installs; no push; no dev server; `vitest run` only.

## Accepted tradeoff (recorded in spec 01 R9)

The floor makes 0–55 homogeneous in CHARACTER but flat in AMOUNT (no tick
grading across the compressed band). The 260925-b7c "new 50 = old 30"
tick-level look-equality is superseded (at 50 the engine used to be "by
design a hard stamp" — that IS the chalk); the curve law itself is untouched.
Relief is always-on at every spread.

## Native UAT rows — PENDING (the user's eye)

- [ ] **Below 50 reads "the same look, finer and harder"** (small tight
      relief) instead of chalk (images 152/153 target)
- [ ] **Spread 60-65 byte-identical** to the approved look (no visible
      change in the working range)
- [ ] **Max spread still richer than min**
- [ ] **`TICK_FLOOR` judged** — if 0–55 still reads chalky, raise the floor
      (one constant in `spreadScale.ts`); if 0–55 reads too loose, the
      per-tick amount needs a spread coefficient (a separate act — the
      solver config is constant today)
- [ ] Tradeoff judged: 0–55 flat in amount (homogeneous) acceptable — or
      flagged
- [ ] 260930-libre rows still standing (painterly relief at 60-65 / `g`
      lever / overshoot) + t2o rows + 52.4 rows a-i

Note: the dy0 series (`3ea4e5f8..32242ccb`), the espace series
(`71fa8521..4917b5a6`), the libre series (`b61c1b82..a502010d`) and this
series stay LOCAL until the look is back — the user pushes.
