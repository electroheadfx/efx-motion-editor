---
phase: quick-260925-b7c
plan: 260925-b7c
title: Recalibrate the Spread scale so the midpoint is the preview-matched width
status: complete
subsystem: packages/efx-physic-paint (core spread law + engine-mirrored harnesses)
tags: [quick, physic-paint, spread-scale, tdd, red-green, texture-gate-recalibration, native-uat-passed, closed]
requires: [QUICK-260925-B7C]
provides: []
affects: [efx-physic-paint/spread-scale, efx-physic-paint/settle]
tech-stack:
  added: []
  patterns: [shared-curve-helper, piecewise-remap-calibration, tdd-red-green, texture-law-spread-engaged]
key-files:
  created:
    - packages/efx-physic-paint/src/core/spreadScale.ts
    - packages/efx-physic-paint/src/core/spreadScale.test.ts
    - .planning/quick/260925-b7c-quick-8d-recalibrate-the-spread-scale-so/260925-b7c-RED-EVIDENCE.json
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts # both local-mode spread sites now call spreadCurveFor
    - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts # parity + W2/W6 texture gates at Spread 80
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts # parity (K_TICKS/spreadCurve mirror)
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts # parity + rm2 texture gate at Spread 80
decisions:
  - "User decision 2026-09-25 (binding, option 1): keep the calibration law intact (new 50 = old 30, new 100 = old 100, 0 = 0); do NOT re-shape the curve; the 3 texture gates move to a spread-engaging setting (Spread 80); d(b) >= 1 floors stay — no weakening to >= 0; all other law gates stay at the default Spread 50"
  - "New texture law: texture is present when spread is ENGAGED (Spread 80, curve 0.636, K=7) — not 'the default must be wet' (default K=1 hard stamp is by design: it is the preview-matched old-30 physics)"
  - "Tasks 1-2 complete: shared spreadCurveFor seam extracted (299cfc83), calibration pins RED (7df3f525, RED_EVIDENCE_OK), curve flipped GREEN (18306203); Task 3 complete after the decision (cde33bbf)"
  - "RED evidence recorded via the documented fhn tooling adapter (flattened leaf TAP + reconstructed # tests block)"
actuals:
  tokens: 7700 # chars/4 over the realized diff (30,669 bytes, 7 files, 76155ee1..HEAD)
  tasks: 3
  commits: 4
metrics:
  duration: ~40min (tasks 1-2 ~25min + Task 3 continuation ~15min)
  completed: 2026-09-25
---

# Quick 260925-b7c: Recalibrate Spread scale — Summary

**Spread slider recalibrated so the midpoint is the preview-matched width: new 50 = legacy 30 bitwise (spreadCurve 0.09), new 100 = legacy 100 (1.0), 0 = 0, monotone — one shared `spreadCurveFor` law consumed by both engine sites and all three harnesses; the 3 texture gates now assert at the spread-engaged setting Spread 80 (d(b) = 12 / 2–3, PASS) per the user's 2026-09-25 decision, every other law gate green at the default, guardrails all held. Native UAT PASSED 7/7 2026-09-25 — CLOSED.**

## Status: CLOSED — native UAT PASSED 7/7 (2026-09-25)

**Quick 260925-b7c is closed.** All 7 native UAT rows approved live by the user.

## User decision applied (2026-09-25 — binding)

The Task 3 law gate STOP (previous executor) was resolved by the user:

1. **Calibration law kept intact** — new 50 = old 30, new 100 = old 100, 0 = 0. The curve in `spreadScale.ts` was NOT re-shaped (empty diff since 18306203).
2. **The 3 texture gates recalibrated to Spread 80** — they assert texture presence at a spread-ENABLING setting, not at the preview-matched default. The texture law is now: **"texture is present when spread is engaged."**
3. **No weakening** — the d(b) >= 1 assertion itself is untouched; it only runs at Spread 80 now. Weakening to d(b) >= 0 (the m7w/ort hard-stamp failure mode) was explicitly refused and not done.
4. **Everything else stays at the default Spread 50** — PIN 0 body ratio 1.0000, PIN 0b floors, determinism, hairline ceiling (W1), monotone (W3), field law (W7), envelope <= 8 all still assert at the default.
5. **Granulation report-back** requested (measure, do not fix) — reported below.

## Commits (4)

| # | Hash | Message | Task |
|---|------|---------|------|
| 1 | 299cfc83 | refactor(260925-b7c): extract spreadCurveFor seam, behavior-identical | Task 1a |
| 2 | 7df3f525 | test(260925-b7c): RED — spread scale calibration pins (+ RED-EVIDENCE.json) | Task 1b |
| 3 | 18306203 | feat(260925-b7c): recalibrate spread scale — midpoint is preview-matched width | Task 2 |
| 4 | cde33bbf | fix(260925-b7c): harness parity + texture gates at spread-engaged setting | Task 3 |

Docs (this SUMMARY, WINDOWS.md, deferred-items.md) intentionally left uncommitted — the orchestrator owns the docs commit.

### Task 1 (RED) — COMPLETE

- Seam `packages/efx-physic-paint/src/core/spreadScale.ts` extracted with the legacy `(s/100)²` law + [0,100] clamp; both engine sites (finalize continuation ~2260, local step ~2534) call `spreadCurveFor(this.state.localSpreadStrength)`; no other engine line changed; full package suite identical to base after extraction.
- RED suite: **Pin 1 failed exactly as planned** — `expected 0.25 to be 0.09 // Object.is equality` at `spreadScale.test.ts:38`; Pins 2-4 (range/zero/monotone) green at base.
- RED evidence machine-verified: `gsd check tdd-red-evidence` → **RED_EVIDENCE_OK**. Record: `260925-b7c-RED-EVIDENCE.json`.

### Task 2 (GREEN) — COMPLETE

- The ONLY production edit: piecewise formula in `spreadCurveFor` — `s ≤ 50 → 0.09·(s/50)`, `s > 50 → 0.09 + 0.91·((s−50)/50)` (bitwise hits 0.09 at 50, 1.0 at 100; monotone on 0.01 and 0.5 sweeps).
- `spreadScale.test.ts` 4/4 green; full package suite at base results; tsc clean.

### Task 3 — COMPLETE (after the user decision)

- **Parity restore:** all three engine-mirrored harnesses import `spreadCurveFor`; `grep -rn "(SPREAD_STRENGTH / 100) \*\* 2" src/core/` → **no hits**; stale "K_TICKS = 3 / 0.25 → 3 ticks" comments updated to the helper (0.09 → 1 tick). `SPREAD_STRENGTH` stays 50 everywhere.
- **Texture-gate recalibration (the decision):** each texture gate now derives its own Spread-80 physics exactly as the engine would — `spreadCurveFor(80) = 0.636` → `K = max(1, ceil(6.36)) = 7` ticks + the matching bbox margin — via a local `TEXTURE_SPREAD_STRENGTH = 80` / `TEXTURE_K_TICKS` used only by the texture gate. The d(b) >= 1 floors are byte-unchanged.

## Gate-by-gate results (before → after)

| Gate | Harness | Before (STOP, default 50) | After (decision applied) |
|------|---------|---------------------------|--------------------------|
| Calibration pins (50→0.09, 100→1.0, 0, monotone) | spreadScale.test.ts | **PASS 4/4** | **PASS 4/4** (untouched) |
| W1 hairline ceiling (thin ≤ drawn + 3px) | physicsWidthScaling | PASS @ default | **PASS @ default** (asserting setting unchanged) |
| **W2 thick physics (thick d(b) ≥ 1 px)** | physicsWidthScaling | **FAIL @ default 50 — d(b) = 0** (6→6/20→20 hard stamp, K=1) | **PASS @ Spread 80 (K=7) — d(b) = 12** (W_dep 20 → W_set 32, both papers); floor still >= 1 |
| W3 monotone (thin ≤ thick) | physicsWidthScaling | PASS @ default | **PASS @ default** |
| W4 PIN 0 / PIN 0b (opacity law) | physicsWidthScaling | PASS (ratio 1.0000; floors) | **PASS @ default** (untouched) |
| W5 determinism (byte-identical) | physicsWidthScaling | PASS | **PASS** (untouched) |
| **W6 production texture (d(b) ≥ 1, r=3)** | physicsWidthScaling | **FAIL @ default 50 — d(b) = 0** (6→6, K=1) | **PASS @ Spread 80 (K=7) — d(b) = 2 / 3 / 3** at water 10/50/90, both papers (6→8 / 6→9); floor still >= 1 |
| W7 field law (neighborhood thickness) | physicsWidthScaling | PASS | **PASS @ default** (untouched) |
| PIN 0 body deposit unmodulated (1.0000) | physicsSettledFootprint | PASS | **PASS** (untouched) |
| PIN 0b post-settle floors ≥ 0.95× | physicsSettledFootprint | PASS | **PASS** (untouched) |
| PIN 3 determinism (footprint) | physicsSettledFootprint | PASS | **PASS** (untouched) |
| (3 deferred/dispositioned skips) | physicsSettledFootprint | skip | skip (pre-existing, ledger 75 + dispositions) |
| pyp sanity + determinism + base PIN 0/0b + outcome table | productionAaSettleMeasurement | PASS | **PASS @ default** (untouched) |
| rm2 envelope (W_visible ≤ 8 @ w50) | productionAaSettleMeasurement | PASS | **PASS @ default** (untouched) |
| **rm2 texture (d(b) ≥ 1, every water, both papers)** | productionAaSettleMeasurement | **FAIL @ default 50 — d(b) = 0** (6→6, K=1) | **PASS @ Spread 80 (K=7) — d(b) = 2 / 3 / 3** at water 10/50/90, both papers (6→8 / 6→9); floor still >= 1 |
| rm2 PIN 0 + PIN 0b HARD gates | productionAaSettleMeasurement | PASS | **PASS @ default** (untouched) |

The Spread-80 d(b) values above are exact gate measurements (temporary probe lines, captured then removed — never committed).

### Final battery (all green except the two pre-existing failures)

- 4 target harnesses: **22 passed | 3 skipped** (the skips are the pre-existing dispositioned/deferred pins, ledger 75).
- Full package suite: **1 failed | 160 passed | 3 skipped** — the sole failure is the pre-existing `EfxPaintEngine.liveAlphaCache` (ledger 74), the only permitted failure. (At STOP it was 4 failed | 157 passed; the 3 texture gates moved to pass.)
- `npm run check` (tsc): **clean** (exit 0).
- App suite (`./node_modules/.bin/vitest run`): **1 failed | 4267 passed** — matches the STOP/base result exactly; the failure is the pre-existing `viteBuild` chunk budget (deferred-items #1, out of scope).

## Granulation report-back (measure only — D-08/D-09 tooth at default, K=1)

Question: does the default (50 = old 30, K=1 tick) still show deposit-time granulation (D-08/D-09 tooth)? Is Physics at default visually indistinguishable from Normal?

What the harness measurements say:

1. **Settle-driven width tooth at default = 0, everywhere.** d(b) = 0 in every cell of all three texture measurements at default 50 (6→6 on the production raster, unchanged cross-section on the gesture). With K=1 the fluid step no longer widens/softens the mark's cross-section — the settle-driven component of the "wet look" (spread, wet-edge width growth) is absent at the default by design.
2. **Deposit-time tooth is intact and byte-identical to the UAT'd state.** The deposit stage (`transferToWetLayerClipped`) never reads the spread strength — PIN 0 = 1.0000 in every cell, keep-gate tier 70, D-08 paper adsorption and D-09 granulation writes all untouched by this quick (locked-surface diffs empty). So every bit of granulation visible at default is deposit-time tooth, exactly as landed and native-UAT'd in 260924-rm2/stb — and exactly what the user measured live as preview-matched at old slider 30 (which also derived K=1).
3. **The 1-tick default settle is not a byte-no-op, but it is width-neutral.** A scratch probe (production raster, default K=1, never committed) measured: 216 of 322 ink pixels in the body window changed alpha, max single-pixel Δalpha ≈ 1810 (one edge pixel), mean alpha 2592.8 → 2612.6 (null paper) and 2618.6 → 2644.7 (synthetic) — about +0.8% mean redistribution inside the same footprint, with zero pixels crossing the visibility floor in the measured column (d(b) = 0).

What the harnesses **cannot** answer: they contain no Normal-mode render path — they measure only the Physics wet pipeline (deposit → settle → display). "Physics at default is visually indistinguishable from Normal" is therefore a live-visual verdict, not a harness verdict; it belongs to the native UAT rows below (especially rows 4, 5, 7). The numbers above establish the mechanism: at default, Physics = the deposit (with its D-08/D-09 tooth, unchanged) + one width-neutral fluid tick; all settle-driven width tooth has moved to spread-engaged settings (>= Spread ~55, K >= 2; fully present at 80).

## Guardrails — all held

- Locked-surface `git diff --name-only` list **EMPTY**: `fluids.ts`, `wet-layer.ts`, `stroke.ts`, `canvas.ts`, `compositor.ts`, `canvas.strokePreviewRibbon.test.ts`, `PhysicsPaintRightPanel.tsx`, `physicsPaintStudioSettings.ts`, every `package.json`, `pnpm-lock.yaml`.
- **Also EMPTY since Task 2:** `spreadScale.ts` (pinned curve untouched by Task 3), `spreadScale.test.ts`, `EfxPaintEngine.ts`.
- **Zero UI file diffs** (slider 0–100 / label Spread / default 50 untouched — references read only).
- `SPREAD_STRENGTH = 50` unchanged in all three harnesses; `TEXTURE_SPREAD_STRENGTH = 80` used only by the texture gates.
- d(b) >= 1 floors unchanged in all 3 texture gates (no >= 0 weakening anywhere).
- No installs, no push, no migration code; `DEPOSIT_KEEP_TIER = 70` untouched; m7w opacity path untouched (PIN 0 = 1.0000 everywhere).
- One shared law: both engine sites + all three harnesses read `spreadCurveFor`; no inline `(s/100)²` copies remain in `src/core/`.
- WINDOWS ledger entry 77 (the STOP deviation) marked **fixed** after the decision landed.

## Deviations from plan

**1. [Rule 3 - Tooling adapter] RED evidence record uses flattened leaf TAP**
- **Found during:** Task 1 RED verification.
- **Issue:** vitest's nested TAP output has no `# tests/# pass/# fail` summary and indents leaf `not ok` lines, which `gsd check tdd-red-evidence` cannot parse (first attempt: INVALID_RED).
- **Fix:** same adapter as the documented precedent 260923-fhn; verdict RED_EVIDENCE_OK.

**2. [User decision - texture gate setting] W2/W6/rm2 texture gates moved from default 50 to Spread 80**
- **Found during:** Task 3 (law-gate STOP: the new default's K=1 derives d(b) = 0, and every fix road touched a pinned surface).
- **Resolution:** explicit user decision 2026-09-25 (binding): recalibrate the 3 gates to a spread-engaging setting; keep the curve; keep the floors; never weaken to d(b) >= 0. Implemented in cde33bbf with before/after documented above. This is a deliberate change of the asserting SETTING, not of any bound.

**3. [Scope boundary] Pre-existing app chunk-budget failure**
- **Found during:** Task 3 app-suite battery. Base probe at STOP proved it pre-existing (1,355.29 kB with this quick's engine diff removed); this quick adds ~0.10 kB. Logged to `deferred-items.md`, not fixed.

## Known Stubs

None.

## Native UAT rows (7) — PASSED 2026-09-25, CLOSED

All 7 rows approved live by the user.

1. ✓ Fresh stroke at default 50 → settled width matches the preview ribbon side-by-side (the "30" feel), pressure gesture intact
2. ✓ Slider 100 → previous maximum bleed still reachable (visibly wetter/wider than default)
3. ✓ Slider 0 → tight mark, minimal spread
4. ✓ Pressure signature at default: hairlines clean, taper visible (260924-stb base no regression)
5. ✓ Stroke body as opaque as before (no m7w wash-out)
6. ✓ Monotone: raise Spread → wider settle, lower → tighter
7. ✓ Normal mode unchanged

## Self-Check: PASSED

- FOUND: packages/efx-physic-paint/src/core/spreadScale.ts
- FOUND: packages/efx-physic-paint/src/core/spreadScale.test.ts
- FOUND: commits 299cfc83, 7df3f525, 18306203, cde33bbf (git log verified)
- FOUND: 4 target harnesses green (22 passed | 3 pre-existing skips); full package 1 failed = pre-existing liveAlphaCache only; tsc clean; app suite matches base
- FOUND: locked-surface diff list empty; SPREAD_STRENGTH still 50; texture floors still >= 1
- SUMMARY closed: `status: complete`, native UAT PASSED 7/7 (2026-09-25)
