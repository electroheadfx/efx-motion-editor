---
phase: quick-260924-rm2
plan: 260924-rm2
title: Land the deposit cutoff in transferToWetLayerClipped — keep-gate tier 70
status: automated-ready
subsystem: packages/efx-physic-paint (core/wet-layer deposit gate)
tags: [quick, physics-paint, footprint, deposit-cutoff, keep-gate, tdd-red-green, envelope, texture]
requires: [260924-pyp, 260924-ort, 260924-nqe, 260924-m7w]
provides: [deposit-keep-gate-70, production-path-contract-pins, pin2-deferral-record]
affects: [native-uat-pending-260924-rm2]
tech_stack:
  added: []
  patterns: [include-exclude-deposit-keep-gate, production-path-contract-pins]
key_files:
  created: []
  modified:
    - packages/efx-physic-paint/src/core/wet-layer.ts
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
key-decisions:
  - "Landed tier 70 (preferred) — integration-path measurement at 70 held every gate; tier 130 fallback never needed; tier 200 never tried (proven hard stamp d(b)=0)"
  - "Cutoff = include/exclude at the deposit keep-gate in transferToWetLayerClipped ONLY; deposit math (a/255)*3000 and all D-08/D-09/D-10/wetness/strokeOpacity untouched — never alpha modulation (m7w 24f40261 failure mode absent)"
  - "PIN 2 explicitly DEFERRED with law text preserved (water-monotone width = future fluids.ts water-coupling feature; nqe structural evidence); synthetic-raster PIN 1 + texture DISPOSITIONED with rationale (synthetic 160/110/60 ramp is not the oracle — contract GREEN on production raster in the pyp harness)"
requirements-completed: [QUICK-260924-RM2]
coverage:
  - id: D1
    description: "Deposit keep-gate cutoff at tier 70 in transferToWetLayerClipped — envelope W_visible <= 8 at default water and texture d(b) >= 1 at every water on the production raster, with PIN 0/PIN 0b body-opacity gates unmoved in both harnesses"
    requirement: QUICK-260924-RM2
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts#260924-rm2 production-path deposit-cutoff contract pins (7/7 green)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts (4 passed | 3 dispositioned/deferred skips, exit 0)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint vitest run package-wide — only pre-existing EfxPaintEngine.liveAlphaCache.test.ts fails"
        status: pass
    human_judgment: false
  - id: D2
    description: "Native UAT of the landed wet-look (6 rows below) — settled stroke matches preview ribbon, body opacity unchanged, Normal mode unchanged, no boil, wet edges + granulation present, water-width non-goal confirmed"
    verification: []
    human_judgment: true
    rationale: "Visual wet-look verification requires the live app — automated pins prove width/opacity contracts but cannot judge the rendered stroke's appearance (m7w history: width-only pins missed a quasi-invisible stroke). Live UAT is pending; no live UAT claimed."
metrics:
  duration: ~7m
  completed: 2026-09-24
  tokens: 2740
  tasks: 3
  commits: 2
plan_head_before: 21d5cd3c127462e1f6e45ab3eba07391984170e8
actuals:
  tokens: 2740
  tasks: 3
  commits: 2
---

# Phase quick 260924-rm2: Deposit Cutoff in transferToWetLayerClipped — Summary

**Deposit keep-gate cutoff landed at tier 70 (include/exclude only, zero alpha
modulation): production-path contract pins GREEN — envelope W_visible 7–8 ≤ 8 at
default water, texture d(b) 1–2 ≥ 1 at every water/paper, PIN 0/0b unmoved in
both harnesses, 0 STOP findings; legacy suite coherent (PIN 2 DEFERRED, synthetic
PIN 1/texture DISPOSITIONED with rationale).**

**Status: `automated-ready` — GREEN shipped, native UAT pending, no live UAT
claimed.**

## Performance

- **Started:** 2026-09-24T18:05:25Z
- **Completed:** 2026-09-24T18:09Z
- **Tasks:** 3/3
- **Commits:** 2 (RED + GREEN; SUMMARY left uncommitted — orchestrator owns docs)

## Carry-over (cited, not redone)

- **260924-pyp = evidence base / oracle.** The 24-cell OUTCOME TABLE on
  production's real continuous AA raster (real transfer → real settle K=3 →
  real wetDisplayAlpha): tier 70 holds envelope ≤ 8 AND d(b) = 1–2 at all
  waters/papers with 0 STOP findings; tier 130 same envelope; tier 200 =
  hard stamp (d(b) = 0); base tier 20 fails envelope on null paper
  (W_visible 9 > 8). This quick converts that table into the shipped fix.
  (pyp SUMMARY: `.planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md`)
- **260924-ort STOP clause (ii) — superseded as oracle by pyp.** On the
  synthetic graduated 160/110/60 ramp every envelope-holding cutoff tier
  yielded d(b) = 0; pyp showed production's real AA ramp achieves the dual
  gate at tiers 130/70. ort's ramp measurements remain the disposition
  basis for the legacy synthetic suite (below).
- **260924-nqe structural proof = basis of the PIN 2 deferral.** The local
  fluid path has no water→settle coupling (`localFluidPhysicsStep` reads
  only `wet.alpha`; wetness passively advected; `fluids.ts` has no
  `waterAmount` read in the local path) — widths are identical across
  waters at base, already true today.
- **260924-m7w alpha-carry failure 24f40261 / revert 1648658b = the
  never-modulate-alpha law.** Modulating deposit alpha to bound width
  produced a quasi-invisible stroke (width-only pins couldn't see it).
  This fix is include/exclude only.

## Mechanism

Inside `transferToWetLayerClipped` (wet-layer.ts) only:

- Named module constant `DEPOSIT_KEEP_TIER = 70` replaces the literal
  keep-gate (`if (a < 20) continue` → `if (a < DEPOSIT_KEEP_TIER) continue`).
- **Include/exclude at the deposit gate ONLY:** pixels with raster alpha
  < 70 never run; included pixels keep the exact base deposit math
  `(a / 255) * 3000` and the untouched D-08 paper adsorption, D-09
  granulation, D-10 subtractive mixing, wetness write, and strokeOpacity.
- **No scaling of depositAlpha/wetness/strokeOpacity with water, tier, or
  any other parameter anywhere** — body pixels keep full alpha
  (body plateau ≈ 244 ≫ 70), verified via PIN 0/0b in both harnesses, not
  assumed. m7w 24f40261 failure mode absent by construction and by pin.
- `transferToWetLayer` (non-clipped), `depositToWetLayer`, fluids.ts,
  compositor, canvas, preview ribbon, paint.ts, brush/stroke.ts all
  untouched.

## Tier decision trail

| tier | verdict (pyp 24-cell table + rm2 integration path) | decision |
| --- | --- | --- |
| 20 (base) | envelope FAIL on null paper (W_visible 9 > 8) | raised |
| **70** | **envelope PASS (7–8 ≤ 8 @ w50 both papers) + texture PASS (d(b) 1–2 all cells) + 0 STOP — measured on the integration path (production gate itself, no pre-filter)** | **LANDED** |
| 130 | identical envelope/texture in pyp table | fallback only — not needed, never tried in production |
| 200 | d(b) = 0 everywhere = proven hard stamp | **NEVER used** |

Landed tier = **70** (the preferred tier). The Task-1 contract pins ARE the
integration-path measurement (raw profile, `applyTier` no-op at ≤ 20 —
`transferToWetLayerClipped`'s own gate decides), so tier 70 passed on the
first GREEN run; the 130 fallback was not exercised.

## Production-path contract-pin table (landed tier — raw profile, production keep-gate 70)

`260924-rm2 PRODUCTION PATH` rows from the GREEN run (`tier` column = 20 =
no in-harness pre-filter; the production gate does the filtering):

| paper | water | tier(pre-filter) | W_deposit | W_settle | W_visible | d(b) | PIN0_min | PIN0_max | PIN0b_meanAlpha | PIN0b_meanDisplay | envelope≤8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| null | 10 | 20 (none) | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.46 | 255.00 | PASS |
| synthetic | 10 | 20 (none) | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2869.02 | 255.00 | PASS |
| null | 50 | 20 (none) | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.46 | 255.00 | PASS |
| synthetic | 50 | 20 (none) | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2869.02 | 255.00 | PASS |
| null | 90 | 20 (none) | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2858.95 | 255.00 | PASS |
| synthetic | 90 | 20 (none) | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2881.18 | 255.00 | PASS |

- **Envelope @ default water 50:** W_visible = 7 (null) and 8 (synthetic),
  both ≤ 8. PASS.
- **Texture d(b) per water/paper at landed tier** (granulation/D-08 path
  untouched): null = 1/1/1 (w10/w50/w90); synthetic = 2/2/1. All ≥ 1. PASS.

## PIN 0 / PIN 0b zero-movement evidence (both harnesses, every water)

- **pyp / production path (hard gates, assertMode true, 0 STOP findings):**
  PIN 0 ratio min = max = **1.0000** in all 6 cells (deposit bytes exactly
  `(a/255)*3000`, D-08-aware expectation recomputed, never read back).
  PIN 0b meanAlpha/meanDisplay vs 0.95× floors (base literals recorded
  in-file, never loosened): null w10 2856.46/255.00 ≥ 2691.16/242.25;
  syn w10 2869.02/255.00 ≥ 2723.74/242.25; null w50 2856.46/255.00 ≥
  2691.16/242.25; syn w50 2869.02/255.00 ≥ 2723.74/242.25; null w90
  2858.95/255.00 ≥ 2706.84/242.25; syn w90 2881.18/255.00 ≥ 2770.18/242.25.
- **Legacy synthetic harness (hard gate):** PIN 0 ratio 1.0000 at waters
  10/50/90 (rows 29–34 incl. partial a=240). PIN 0b: w10 2678.85/230.84 ≥
  2544.23/219.16; w50 2678.85/230.84 ≥ 2544.23/219.16; w90 2665.18/229.88 ≥
  2545.69/219.32.
- Neither PIN moved by the cutoff in either harness → no STOP clause fired;
  GREEN authorized.

## PIN 2 deferral record (user decision — law text preserved)

PIN 2 (strict water-monotone width: width(90) > width(50) > width(10)) is
converted to `it.skip('DEFERRED (260924-rm2): …')` in
`physicsSettledFootprint.test.ts` with the full original law text and body
**preserved verbatim** plus a visible rationale comment:

- Known gap: water does not widen the mark today — same as at base per nqe's
  structural proof (local fluid path has no water→settle coupling; widths
  identical across waters at base).
- Deferred to a **future fluids.ts water-coupling feature** — NOT part of
  this fix.
- The strict-monotone law must not be loosened, reshaped, or faked green —
  future work must satisfy the text as written. No assertion was deleted.

## Synthetic-suite dispositions (PIN 1 + texture)

Both still FAIL on the legacy harness at landed tier 70 — exactly ort's
threshold-70 measurement on the graduated 160/110/60 ramp
(W_deposit 10, d(b) = 0; PIN 1: 10 > 8). Dispositioned in-file as
`it.skip('DISPOSITIONED (260924-rm2): …')` with full rationale comments and
**assertion code kept visible and unchanged** (never deleted, never
loosened, never reshaped; the raster was not altered to fake a pass):

- **The synthetic graduated 160/110/60 ramp is NOT the oracle for this
  contract** — nqe proved the two-valued ramp cannot express the dual gate;
  ort's complete outcome space on the graduated ramp hit STOP clause (ii)
  (every envelope-holding config = hard stamp).
- **The contract is asserted GREEN on the production raster** by the
  260924-pyp / 260924-rm2 production-path contract pins
  (`productionAaSettleMeasurement.test.ts`) at the landed tier:
  envelope ≤ 8 @ w50 AND d(b) ≥ 1 @ every water, both papers, PIN 0/0b
  in bounds.

## Legacy suite — final coherent state (test-by-test)

| # | test | state |
| --- | --- | --- |
| 1 | measurement sweep: stage widths (all cells) | PASS |
| 2 | PIN 1: default-water W_visible ≤ 2r+2px | DISPOSITIONED (skipped, rationale in-file; contract GREEN in pyp harness) |
| 3 | PIN 2: water-monotone width | DEFERRED (skipped, law text preserved, rationale in-file) |
| 4 | PIN 0: body deposit unmodulated ±1% | PASS |
| 5 | PIN 0b: post-settle body means ≥ 0.95× floors | PASS |
| 6 | texture gate: d(b) ≥ 1 at default water | DISPOSITIONED (skipped, rationale in-file; contract GREEN in pyp harness) |
| 7 | PIN 3: determinism (no boil) | PASS |

**4 passed | 3 skipped, exit 0 — zero unexplained RED.** No assertion deleted
or loosened anywhere.

## Task Commits

1. **Task 1: RED — production-path contract pins + PIN 2 deferral (tests-only)** - `0f0be611` (test)
2. **Task 2: GREEN — deposit keep-gate cutoff at tier 70** - `d84eb55f` (fix)

**Task 3: no commit** (verification + this SUMMARY — orchestrator owns docs).
Measured from ledger `21d5cd3c`: 2 commits. RED evidence record verified:
`gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (target test
"envelope: W_visible <= 8 at DEFAULT water 50, both papers" failed on a real
assertion, exit 1) before any production edit.

## Files Created/Modified

- `packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts` —
  new `260924-rm2 production-path deposit-cutoff contract pins` describe
  (envelope, texture, PIN 0/0b hard gates on the raw production path)
- `packages/efx-physic-paint/src/core/wet-layer.ts` — `DEPOSIT_KEEP_TIER = 70`
  constant + comment; gate line in `transferToWetLayerClipped` only
  (diff = 23 insertions + 1 gate line; deposit arithmetic untouched)
- `packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts` —
  PIN 2 DEFERRED record + PIN 1/texture dispositions (law texts preserved)

## Verification battery (Task 3)

1. **pyp suite (incl. contract pins):** `vitest run
   src/core/productionAaSettleMeasurement.test.ts` → **7 passed (1 file),
   exit 0** — 4 pre-existing (sanity, PIN 3, base-tier, OUTCOME TABLE) +
   3 new contract pins; **0 STOP findings**; production-path table captured
   above.
2. **Legacy suite:** `vitest run src/core/physicsSettledFootprint.test.ts`
   → **4 passed | 3 skipped (7), exit 0** — enumerated test-by-test above;
   zero unexplained RED.
3. **Package-wide regression:** `vitest run` (whole
   `packages/efx-physic-paint`) → **1 failed | 15 passed files (16);
   1 failed | 149 passed | 3 skipped tests (153)** — the ONLY failure is
   the **pre-existing `EfxPaintEngine.liveAlphaCache.test.ts`** (confirmed
   failing at base, deferred from 260924-koa; not absorbed). No other
   failure; nothing traces to the cutoff → no STOP.
4. **Guardrails:**
   - `git diff --name-only` over locked files (fluids.ts, compositor.ts,
     canvas.ts, canvas.strokePreviewRibbon.test.ts, brush/paint.ts,
     brush/stroke.ts) → **empty**.
   - wet-layer.ts diff confined to the gate constant + comment + gate line
     (`(a/255)*3000` line and all D-0x math byte-identical).
   - GREEN commit contains exactly `wet-layer.ts` +
     `physicsSettledFootprint.test.ts`; RED commit exactly the two test
     files. No package.json / pnpm-lock changes; no installs; no UI files.
   - Working tree clean at finish (SUMMARY is the only new file, left
     uncommitted). No push.

## Evidence citation

260924-pyp OUTCOME TABLE (24 cells, 0 STOP findings):
`.planning/quick/260924-pyp-measure-production-s-continuous-aa-raste/260924-pyp-SUMMARY.md`
— tier-70 rows (envelope PASS, d(b) 1–2, PIN0 1.0000, PIN0b ≥ floors) are
the basis for choosing 70; tier-200 rows (d(b)=0) justify the never-use
rule; tier-20 rows (null FAIL 9>8) justify raising the gate.

## Native UAT rows (pending — VERBATIM from plan Task 3)

1. Physics, default water → settled stroke matches preview ribbon side-by-side, taper visible
2. stroke body FULLY as opaque as before (side-by-side vs pre-fix build — no wash-out)
3. Normal mode unchanged
4. two identical strokes in a held pose → identical footprint (no boil)
5. regression: wet edges + granulation present (NOT a hard stamp), cursor ring unchanged
6. documented non-goal: water does not change width (same as today) — confirm no accidental change either way

**Explicit note: status is `automated-ready` — GREEN shipped, native UAT
pending, no live UAT claimed.** Do not read this SUMMARY as a done claim;
only live UAT proves the wet look (m7w lesson: automated width pins cannot
judge appearance).

## Decisions Made

- Tier 70 landed on first integration-path measurement (preferred tier; 130
  fallback unused; 200 never tried).
- PIN 2 deferral executed per the plan's user decision with law text intact.
- PIN 1/texture dispositioned (not deleted/loosened) against the pyp oracle,
  per plan Task 2 step 4 — synthetic ramp measurements (W_deposit 10,
  d(b)=0 at gate 70) match ort's prediction exactly.

## Deviations from Plan

**None — plan executed exactly as written.** No STOP clause fired:
PIN 0/0b unmoved in both harnesses; texture d(b) ≥ 1 at every water on the
production raster; envelope holdable at 70 (fallback not needed); package
regression shows only the pre-existing liveAlphaCache failure.

## Issues Encountered

None.

## Known Stubs

None — no stubbed values/UI/data paths; the three skipped legacy tests are
explicit plan-mandated dispositions documented above (PIN 2 deferral + two
raster dispositions), with all assertion code visible and the contracts
proven GREEN on the production raster.

## Threat Flags

None — no new network/auth/file-IO/schema surface; the only production edit
is the sanctioned gate line (T-rm2-01/02/03/04 held: include/exclude only,
locked files untouched, bounds never loosened, no installs).

## Self-Check: PASSED

- FOUND: .planning/quick/260924-rm2-land-the-deposit-cutoff-in-transfertowet/260924-rm2-SUMMARY.md
- FOUND: packages/efx-physic-paint/src/core/wet-layer.ts (modified, committed)
- FOUND: packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts (modified, committed)
- FOUND: packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts (modified, committed)
- FOUND commits: 0f0be611 (Task 1 RED), d84eb55f (Task 2 GREEN); ledger count = 2 (from 21d5cd3c)
- Guardrail `git diff --name-only` empty for all 6 locked files; no package.json/pnpm-lock changes
- Working tree clean except this SUMMARY (left uncommitted — orchestrator owns docs commit); no push
- pyp suite 7/7 green incl. contract pins (0 STOP findings); legacy 4 passed | 3 dispositioned/deferred skips, exit 0; package-wide only pre-existing liveAlphaCache failure

---

*Phase: quick-260924-rm2*
*Completed: 2026-09-24*
