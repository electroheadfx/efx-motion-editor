---
phase: quick/261123-hr5
plan: 01
subsystem: engine
tags: [emboss, relief, signed, watercolor, bristle, probe, headless-chrome, preact-signals]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: relief target (HALF_FLOAT_R), brushRelief/bristleReliefPass, the medium-engine probe harness, the 64-31 alpha law fields in compare.mjs
  - phase: quick-261117 / 64-x
    provides: EMBOSS_MAX 15 row band, SliderStepper negative floors, the recorded-bag -> toEngineParams pipeline
provides:
  - signed Emboss (-15..15 slider; engine -1..1 through the ONE canonical mapping)
  - negative relief branch that erodes ONLY the relief target with the dab's own mask (ZERO, ONE_MINUS_SRC_COLOR)
  - probe scenario `emboss-smooth` + compare mode `--relief-smooth` (self-contained smoothing relation)
  - calibrated constant RELIEF_ERODE_NEGATIVE = 20 with two-arm measured evidence
affects: [studio paint UAT, future relief work, probe harness scenario list]

actuals:
  tokens: 13473
  tasks: 3
  commits: 6
  plan_head_before: 863fe7fc3804feb3cb780ba830684e09a3008723
  plan_head_after: e82aa2b71934b22ff3cebc9f8f4be2ef8efd542e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signed band through the ONE canonical mapping (clampSignedUnit) — never a second clamp site"
    - "Erode reuses the Lift/coverPass blend pair (ZERO, ONE_MINUS_SRC_COLOR); no shader change"
    - "Self-contained probe relation mode (--relief-smooth) with no reference capture"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/playground/relief.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts

key-decisions:
  - "The signed clamp lives ONLY in toEngineParams (clampSignedUnit, -1..1); medium records stay >= 0 — the sign is a per-stroke recorded-bag property"
  - "The negative erode is gated ONLY by the recorded emboss sign; paint never auto-erodes relief under its coverage (the approved acrylic GAP-1 law stands)"
  - "Undo rides the dab's own touch rect (brushInk 1.5 / bristleInk 1.6, PROTECT_MARGIN 24) — no new protection site, no new undo step"
  - "Shipped RELIEF_ERODE_NEGATIVE = 20, calibrated on both probe arms (constant 1 failed the half-the-relief bar on both)"
  - "The scenario message enumeration places 'emboss-smooth' before 'bristle-tip' so the 64-29 harness pin ('or \"bristle-tip\")') stays literal without editing that test"

patterns-established:
  - "Signed sliders: canonical -100..100 -> engine -1..1 in the ONE mapping; row band in aquarelleParamVisibility (min+max), never in the panel"
  - "Probe scenario with a before/after relief readback: captureRelief markers + g.readHalf on the private relief target (no new public export)"

requirements-completed: []

coverage:
  - id: D1
    description: "LIVE — acrylic bristle brush: paint a +15 impasto band, then paint across it at Emboss -10..-15; the band visibly flattens, the paint stays (no hole, no paper-white), and the relief light follows the new surface"
    verification: []
    human_judgment: true
    rationale: "Visual smoothing on a live GPU sheet is the artist's judgment; the probe proves the numbers, not the look"
  - id: D2
    description: "SETTLE — release and let the sheet settle: the smoothed relief stays smoothed (no bounce back)"
    verification: []
    human_judgment: true
    rationale: "Live-over-committed settle behavior is only observable in the running app"
  - id: D3
    description: "RE-RENDER — run one re-render: the committed key re-bakes to the same smoothed, shaded result (the committed base keeps its baked shading in the gaps until that re-render — known residual, not a defect)"
    verification: []
    human_judgment: true
    rationale: "Re-bake parity of a committed key is a live UI surface"
  - id: D4
    description: "IDENTITY — Emboss 0 paints exactly as today; a positive Emboss is unchanged; the slider spans -15..15 with 0 at the middle"
    verification:
      - kind: other
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs emboss-pos15 --other emboss-pos15-head && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity --other neutral-identity-head"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts, aquarelleParamVisibility.test.ts"
        status: pass
    human_judgment: true
    rationale: "The byte-identity and band are automated-ready, but the slider's live feel/readout is an artist surface — confirm live before closing"

# Metrics
duration: 15min
completed: 2026-11-23
status: complete
---

# Quick 261123-hr5: Studio Paint Signed Emboss Summary

**Signed Emboss: one -15..15 slider whose negative half subtracts paint thickness through the dab's own relief mask (ZERO, ONE_MINUS_SRC_COLOR — the Lift law), proven on both masks by a new `emboss-smooth` probe relation: -15 halves a +15 impasto's band relief and keeps the pigment**

## Performance

- **Duration:** ~15 min (plan authored 11:58Z; final gate re-run 12:13Z)
- **Started:** 2026-11-23T11:58:00Z
- **Completed:** 2026-11-23T12:13:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Emboss is signed end to end: `toEngineParams` clamps -1..1 via the new `clampSignedUnit` (the ONE mapping; medium records stay >= 0), the recorded bag carries -15 unchanged, and a -15 stroke replays byte-identically.
- The relief slot gained a single `else if (reliefAmount < 0)` branch with two private passes (`reliefErode`, `bristleReliefErode`) that erode ONLY `this.relief` under `FUNC_ADD` + `ZERO, ONE_MINUS_SRC_COLOR` — `fixed`/`ink`/`cover` are structurally absent, so GAP-1 stands; undo rides the dab's existing `touch` rects.
- The Emboss row now spans -15..15 (EMBOSS_MIN added beside EMBOSS_MAX); a stored -7 passes through, -40 reads -15, 40 still reads 15, and every other row keeps 0..100.
- New probe scenario `emboss-smooth` (two entries over the same band, `captureRelief` markers, private relief-target readback) plus a self-contained `--relief-smooth` compare mode (mean halves, peak down, pigment kept) and six-field parity in `--other`.
- `RELIEF_ERODE_NEGATIVE` calibrated to **20** on both masks; all four planned gates plus replay parity pass on the committed tree.

## Task Commits

Each task was committed atomically (TDD: RED -> GREEN):

1. **Task 1: Signed emboss — ONE mapping, the negative relief branch, two erode passes, pinned laws**
   - `7324c9b27` (test) — RED: params inversion, determinism row, relief pins (9 planned failures)
   - `206a19c08` (feat) — GREEN: clampSignedUnit, branch, reliefErode/bristleReliefErode
2. **Task 2: Emboss row spans -15..15 — one signed band, every other row unchanged**
   - `7c0bb5130` (test) — RED: band pins (3 planned failures)
   - `9023263f2` (feat) — GREEN: EMBOSS_MIN, row min, record-state doc
3. **Task 3: Probe scene `emboss-smooth`, calibration, and the four gates**
   - `30e8db78e` (feat) — probe/run/compare scene + constant 1 -> 20
   - `e82aa2b71` (fix) — message-tail positioning for the 64-29 pin (see Deviations)

**Plan metadata:** not committed here — the orchestrator commits the docs.

## Calibration record (output a)

Shipped value: **`RELIEF_ERODE_NEGATIVE = 20`** (`Engine.ts`; the per-dab erode is `Math.min(1, -reliefAmount * RELIEF_ERODE_NEGATIVE)` over the dab's own mask).

Measured on the `emboss-smooth` scenario (emboss 15 impasto, then a normal pass at the smooth sign -15; band box x 0.24..0.76, y 0.24..0.68):

| Arm | Gate | reliefMean before -> after | reliefPeak before -> after | pigmentMean before -> after | Verdict |
|-----|------|---------------------------|---------------------------|-----------------------------|---------|
| watercolor (reliefFS mask) | `emboss-smooth` | 0.0024 -> 0.0010 (-58%) | 0.0659 -> 0.0167 (-75%) | 5.6404 -> 9.5378 (kept, +69%) | PASS |
| bristle gather (`--brush bristle-flat`) | `emboss-smooth-bristle` | 0.0081 -> 0.0007 (-91%) | 0.225 -> 0.141 (-37%) | 9.4344 -> 10.2489 (kept) | PASS |

At the provisional constant **1** both arms FAILED the half-the-relief bar: watercolor 0.0024 -> 0.0023 (-4%), bristle 0.0081 -> 0.0068 (-16%). Modeling removal as exponential in the constant (k ~ 0.043 watercolor, k ~ 0.175 bristle) pointed at 20; the re-run confirms it. Only the one constant moved — the blend pair, masks and shaders are untouched.

`Math.min(1, ...)` stays inert at the shipped band: at -15 with both bags the per-dab erode is ~0.06 max, so `1 - src` never approaches 0 and the multiply can never flip into an add.

## Gate results (output b)

1. **Smoothing + kept paint, watercolor:** `compare.mjs emboss-smooth --relief-smooth` — PASS (all four bars).
2. **Smoothing + kept paint, bristle:** `compare.mjs emboss-smooth-bristle --relief-smooth` — PASS.
3. **Real-engine replay parity:** `emboss-smooth-a` vs `emboss-smooth-b` via `--other` — PASS, all 12 fields equal plus the six relief/pigment readings equal (digests a9f284b2 / 9e9c0e72 / 4f9264ea / 6c38f77f; byteLength 262144).
4. **Positive byte-identity:** `emboss-pos15` (--emboss 15) vs the pre-change HEAD capture `emboss-pos15-head` via `--other` — PASS, 12/12 fields equal (digests 202fec08 / 26983446 / 20a6ecc0 / c423bd83; opaqueExportMinAlpha 255, visibleAlphaMaxDelta 0).
5. **Emboss 0 identity:** `neutral-identity` vs the pre-change HEAD capture `neutral-identity-head` via `--other` — PASS, 12/12 fields equal (digests d2bd637a / 291d4a11 / 6ba88334 / 13b8af1d).

**Known follow-up (not repaired here, per decision):** the committed `baselines/neutral-identity.json` is stale — it predates 64-31 and lacks the five alpha-law fields, so the committed-baseline mode fails at HEAD on missing REFERENCE fields even though every digest matches. The quick deliberately did NOT re-capture or edit that baseline and did NOT widen `REFERENCE_OPTIONAL`; the identity gate uses the pre-change HEAD captures via `--other`. Repairing the committed baseline is a separate follow-up.

**Full gates:** `pnpm --dir packages/efx-watercolor exec vitest run` — 41 files, 984 passed, 8 skipped (after the fix below). `pnpm --dir app exec vitest run` — 465 files, 9796 passed, 1 skipped, 96 todo on the first full run with all plan changes (see Deferred Issues for a subsequent unrelated flake). `pnpm --dir app exec tsc --noEmit` — exit 0. Untouchable audit `git diff --exit-code 863fe7fc3..HEAD -- shaders.ts mediums.ts mediums.test.ts` — exit 0. `git diff --stat 863fe7fc3..HEAD` lists exactly this plan's 12 files.

## Pinned laws that moved (output c)

- **`params.test.ts`** — the emboss clamp rows inverted: superseded `-40 -> 0` and `-250 -> 0`; now `-40 -> -0.4`, `-250 -> -1`, with `15 -> 0.15`, `-15 -> -0.15`, `0 -> 0`, `250 -> 1`; the case title names the signed global -100..100 band. Body and NaN/Infinity rows unchanged.
- **`relief.test.ts`** — the "exactly two call sites" pin superseded: `drawRelief(` is now 3 (brushRelief, lift, reliefErode); `this.brushRelief(` / `this.bristleReliefPass(` stay 1 each; new call-site pins `reliefErode(` / `bristleReliefErode(` at 1 each. Two slice end anchors moved to `'private reliefErode('` (so the brushRelief/bristleReliefPass slices stay scoped). New `describe('signed emboss (quick 261123-hr5)')` pins the constant declaration, the branch order and absences, both blend pairs, and the `stampRect(..., 1.6)` rect with no `touch(`.
- **`aquarelleParamVisibility.test.ts`** — superseded `emboss.min === undefined`; now `emboss.min === -15` / `max === 15`, every other row min and max undefined.
- **`AquarelleGlobalsPanel.test.ts`** — superseded "post-UAT 2026-11-21 emboss row cap" (min 0 / max 15); now the signed-band law: min -15 / max 15, -7 passes through, 40 -> 15, -40 -> -15; Viscosity stays 0..100.
- **`determinismContract.test.ts`** — new row: an emboss -15 stroke replays byte-identically, carries -15, projects to -0.15.
- **Probe harness** — `readEmboss()` widened to finite -100..100; `'emboss-smooth'` added to both closed scenario lists (readScenario whitelist + message, run.mjs whitelist + message + usage); `compare.mjs` FIELDS-parity in `--other` now also compares the six relief/pigment fields when both captures carry them.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/params.ts` — `clampSignedUnit`; emboss routed through it; signed-band docs.
- `packages/efx-watercolor/src/playground/Engine.ts` — signed `Params.emboss` doc, `RELIEF_ERODE_NEGATIVE = 20`, the `else if (reliefAmount < 0)` branch, `reliefErode`, `bristleReliefErode`.
- `packages/efx-watercolor/src/playground/params.test.ts`, `relief.test.ts`, `determinismContract.test.ts` — the pinned laws above.
- `packages/efx-watercolor/probe/medium-engine/probe.ts` — `emboss-smooth` scenario, `captureRelief`, relief band stats, `embossSmoothReport`, signed `readEmboss`.
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — signed operand validation, scenario in the closed list and usage.
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — `--relief-smooth` mode, `RELIEF_SMOOTH_FIELDS`, six-field `--other` parity.
- `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` — `EMBOSS_MIN = -15`, row `min`, one-home doc.
- `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts`, `AquarelleGlobalsPanel.test.ts` — signed-band pins.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — comment only: emboss is the ONE signed key; a medium record never carries a negative value.

## Decisions Made

- Signed clamp in the ONE canonical mapping; medium records stay >= 0 (T-64-01 holds).
- Erode gated only by the recorded sign; undo via the existing per-stamp touch (T-HR5-02/T-HR5-04 mitigations pinned by absence tests).
- Reused the Lift/coverPass blend pair so no shader changes (T-HR5-01: the amount clamp keeps `1 - src` non-negative).
- Constant 20 chosen from two-arm measurement, not feel.
- Message-tail placement to keep the 64-29 harness literal stable (see below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Closed-list error message broke the 64-29 harness pin**
- **Found during:** full-gate run after Task 3
- **Issue:** appending `" or "emboss-smooth"` to both scenario messages changed the tail that `harness.test.ts` pins as `or "bristle-tip")`, failing "declares bristle-tip in both closed lists".
- **Fix:** `emboss-smooth` was placed before `bristle-tip` in both enumerations (`..."bristle-end", "emboss-smooth" or "bristle-tip")`), keeping the pinned literal intact without editing the 64-29 test (which is outside this plan's files). The whitelist conditions and both closed lists remain literal-identical.
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/run.mjs`, `probe.ts`
- **Verification:** harness.test.ts 136/136; whole package suite green.
- **Committed in:** `e82aa2b71`

**2. [Rule 3 - Blocking] `--brush` does not reach neutral-derived entries**
- **Found during:** Task 3 scenario wiring
- **Issue:** the existing brush routing resolves the brush only for specific scenarios, so `emboss-smooth` entries would have run on the default brush even with `--brush bristle-flat`.
- **Fix:** `embossSmoothScript` takes an explicit optional `brushId` and stamps it on both entries; the scenario selection passes the resolved brush (or `--brush`).
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/probe.ts`
- **Verification:** `emboss-smooth-bristle` capture reports brush `bristle-flat`.
- **Committed in:** `30e8db78e`

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). No scope creep; both stay inside the plan's file list.

## Issues Encountered

- The bristle arm's non-skipped visible-alpha check passed empirically (visibleAlphaMaxDelta 0), so no probe-only alpha-law adjustment was needed.
- `--scenario neutral` is not a valid value (neutral is the omitted scenario); identity captures run with `--scenario` omitted, as the plan's step-0 commands did.

## Deferred Issues

- **Flaky full app suite (pre-existing, unrelated):** two later full `app` runs hit a load-timing failure in `src/lib/physicPaintBridge.test.ts` (Phase 63-05 realm channels; a different test each run — a 20 s bounded-wait timeout, then an operationId/catalog expectation). The same file passes in isolation (186 passed, 3.9 s), and the first full run with all plan changes was green (465 files, 9796 passed). No file under `app/src/lib/` is touched by this plan. Out of scope; left as-is.
- **Stale committed `baselines/neutral-identity.json`** (decided at planning time): needs the five 64-31 alpha-law fields; not repaired here.

## UAT rows (artist-run — automated-ready, NOT passed)

1. **LIVE** — acrylic bristle brush: paint a +15 impasto band, then paint across it at Emboss -10..-15; the band visibly flattens, the paint stays (no hole, no paper-white), and the relief light follows the new surface.
2. **SETTLE** — release and let the sheet settle: the smoothed relief stays smoothed (no bounce back).
3. **RE-RENDER** — run one re-render: the committed key re-bakes to the same smoothed, shaded result. On a fresh-session key the committed base keeps its baked shading in the gaps until that re-render — the known live-over-committed residual, not a defect.
4. **IDENTITY** — Emboss 0 paints exactly as today; a positive Emboss is unchanged; the slider spans -15..15 with 0 at the middle.

## Next Phase Readiness

- Code complete and committed; all automated gates green on the final tree.
- The artist's live UAT above is the remaining gate before closing the quick.
- Follow-up: repair the committed `neutral-identity` baseline with the 64-31 fields.

---
*Quick: 261123-hr5*
*Completed: 2026-11-23*

## Self-Check: PASSED

- Files verified: all 12 plan files plus this SUMMARY exist on disk.
- Commits verified: 7324c9b27, 206a19c08, 7c0bb5130, 9023263f2, 30e8db78e, e82aa2b71 are all ancestors of HEAD (e82aa2b71).
- Commit count measured from the plan ledger: 6 (863fe7fc3..HEAD).
