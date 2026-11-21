---
phase: quick/261121-w5n
plan: 01
subsystem: paint-engine
tags: [acrylic, bristles, dab-spacing, device-pixel-floor, loop-guard, probe, headless-chrome]

requires:
  - phase: 64-medium-engine
    provides: the shipped acrylic dab chain (carrier + pickup snapshot + three deposits + cover + touch + relief + wet) and the D-20 first-paint/re-bake determinism contract
  - phase: quick/261121-umu
    provides: the acrylic family's pressureLink/speedLink decoupling and the headless-Chrome probe harness pattern
provides:
  - "a bristle response's dab spacing floored at one device pixel, with that dab's ink multiplied by exactly the ratio the floor applied"
  - "a terminating trace dab loop: an oversized carry is spent as one catch-up dab, a non-positive spacing breaks the loop"
  - "the small-brush probe (probe/small-brush) with a frozen BEFORE capture and an AFTER compare that proves the inert sizes byte-identical"
affects: [medium-engine, acrylic-uat, studio-paint]

actuals:
  tokens: 12423
  tasks: 3
  commits: 4
  plan_head_before: c39bcca98bb7d04f7ac207bf8d304d2222b391f4
  plan_head_after: 94c86389493ab4ac7f40ea14d0517fcd9b148c7d

tech-stack:
  added: []
  patterns:
    - "A device-pixel floor on a document-space spacing, compensated by the exact mirror of the shipped supersampling law (which divides spacing and amount by the same factor)"
    - "A non-positive-step branch that spends the carry as ONE catch-up dab (bounded by n <= 48 per trace) instead of replaying every overdue dab at one point"

key-files:
  created:
    - packages/efx-watercolor/probe/small-brush/index.html
    - packages/efx-watercolor/probe/small-brush/probe.ts
    - packages/efx-watercolor/probe/small-brush/run.mjs
    - packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts
    - .planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-BEFORE.json
    - .planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-AFTER.json
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts

key-decisions:
  - "The floor is one DEVICE pixel (1/dh), not a document-space constant: the render targets are allocated at dw x dh, so the document grid IS the device grid"
  - "The compensation is the mirror of the supersampling law — amount *= floorPx / spacing0 — so wash per distance is unchanged where the floor binds"
  - "The inert path takes no arithmetic at all: spacing === spacing0 and amountScale === 1, so the byte identity is by construction rather than a quotient that happens to equal 1"
  - "A non-positive step emits one catch-up dab at the segment start and resets the carry; a non-positive spacing breaks — the loop can no longer spin"

requirements-completed: []

coverage:
  - id: D1
    description: "A bristle response below the device-pixel crossover emits at most one dab per device pixel of travel"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts#floors a Size 1 Bristle Round at one device pixel"
        status: pass
      - kind: integration
        ref: "packages/efx-watercolor/probe/small-brush (AFTER compare: size 1 223 -> 95, size 10 120 -> 95 dabs)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Where the floor does not bind, the render is byte-identical to HEAD (dabs, transparent and pigment digests, byte length)"
    verification:
      - kind: integration
        ref: "packages/efx-watercolor/probe/small-brush (AFTER compare: sizes 30 and 100 identical on all four values)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts#leaves Size 30 and Size 100 on the shipped spacing"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Size 10 stroke paints identically on first paint and on a re-bake of the same recorded payload, in both captures"
    verification:
      - kind: integration
        ref: "packages/efx-watercolor/probe/small-brush (paritySize10 equal BEFORE and AFTER)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A trace whose spacing collapses, whose carry is oversized, or whose radius is zero terminates"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts#trace() dab loop — termination guard (3 pins, recorder throws after 10000 dabs)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The artist judges the small brushes responsive in the app and the 30/100 px strokes unchanged from the shipped build"
    verification: []
    human_judgment: true
    rationale: "Responsiveness and in-app pixel fidelity are live judgments on the artist's own machine and strokes; the probe pins the same laws on a fixed headless scene but cannot stand in for that judgment."

metrics:
  duration: 12min
  started: 2026-11-21T22:16:01Z
  completed: 2026-11-21T22:28:13Z
  tasks: 3
  files: 8
  commits: 4
status: complete
---

# Quick 261121-w5n: Floor the acrylic bristle dab at one device pixel

**A Bristle Round stroke stops emitting several dabs per device pixel below ~30 px — Size 1 falls 223 → 95 dabs and Size 10 120 → 95 over 100 px of travel — while Size 30 and Size 100 render byte-identically to HEAD (transparent and pigment digests equal), and the trace loop can no longer spin on a spacing collapse.**

## Performance

- **Duration:** 12min (PLAN.md written → AFTER-evidence commit)
- **Started:** 2026-11-21T22:16:01Z
- **Completed:** 2026-11-21T22:28:13Z
- **Tasks:** 3/3
- **Files modified:** 8 (2 production-adjacent source/test edits under `src/playground`, 3 probe files, 2 evidence JSON, 1 existing-test pin)

## Task Commits

1. **Task 1: Small-brush probe — freeze the HEAD baseline** — `eeaefd263` (test)
2. **Task 2: Floor bristle dab spacing at one device pixel and mirror the ink ratio** — `b14b7ebe6` (fix)
3. **Task 3a: Follow the `let` declaration in the supersampling source pin** — `7d64aff46` (test, deviation Rule 3)
4. **Task 3b: Record the AFTER capture — the identity proof** — `94c863894` (test)

Docs artifacts (this SUMMARY, STATE.md, PLAN.md) are intentionally left uncommitted; the orchestrator owns the docs commit.

## RED evidence (Task 2, on the shipped engine)

`pnpm --dir packages/efx-watercolor exec vitest run src/playground/engineTraceSpacing.test.ts` → **6 failed | 2 passed (8)** before `Engine.ts` was touched. The failing pins included the zero-radius runaway (the recorder threw at 10 000 dabs instead of hanging vitest) and the oversized-carry case (the shipped loop stamped left of the segment start). GREEN: **18 passed (18)** across the new suite and the `engineScriptWidth` precedent.

## Before/after probe evidence

Harness: `node packages/efx-watercolor/probe/small-brush/run.mjs --gate <name> --out <path> [--compare <before>]` — real adapter + real `WatercolorEngine` in headless Chrome (WebGL2, swiftshader), `bristle-round`, acrylic record, pressure 0, 0xc0ffee paper seed, 1080×1080 sheet, 100 device px of sampled travel, 8 settle ticks. The probe source is frozen between the two gates (`git status --porcelain -- packages/efx-watercolor/probe/small-brush` empty).

- Before: `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-BEFORE.json` (engineHead `c39bcca98bb7d04f7ac207bf8d304d2222b391f4`)
- After: `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-AFTER.json` (engineHead `7d64aff468ebb3eb153822df9089a6e38860d5d5`)

| Size | spacingPx | floorBinds | dabs BEFORE → AFTER | ratio | digest verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.3974 | true | 223 → **95** | 0.426 | rebaked at the new density (expected) |
| 10 | 0.7373 | true | 120 → **95** | 0.792 | rebaked at the new density (expected) |
| 30 | 2.9111 | false | 31 → 31 | 1.000 | transparent `2e13e726`, pigment `dcf85116`, 4 665 600 B — **identical** |
| 100 | 1.7801 | false | 50 → 50 | 1.000 | transparent `f30ca1ab`, pigment `8201f9a9`, 4 665 600 B — **identical** |

The binding sizes land at **95**, not 100: the scripted feed smooths the 11 sampled points (k = 0.65) so the engine's own arc length is 94.6155 px, and 94.6 one-device-pixel gaps plus the start dab is 95. The probe reports `travelledPx` and the stamped spacing (`0.4256` / `0.7896` / `3.1176` / `1.9064` px) so the counts reconcile line by line: 94.6155 / 1.0 → 95, 94.6155 / 3.1176 → 31, 94.6155 / 1.9064 → 50.

**Why the BEFORE counts are 223/120 and not the plan's predicted 252/136.** Investigated, not tuned (per the plan's instruction). Two shipped-feed facts the prediction omitted: (a) `scriptPressure` clamps the authored pressure 0 to its 0.02 floor, so the stamped radius is 7.09 % larger and the spacing is `spacingPxStamped`, not `spacingPx`; (b) the pointer smoothing turns the 100 sampled px into 94.6155 px of engine travel. Both were measured and are reported by the probe (`stampedPressure`, `spacingPxStamped`, `travelledPx`); the spacing law itself matched the prediction exactly (`0.3974 / 0.7373 / 2.9111 / 1.7801`). Both captures repeated in independent processes with identical digests and parity.

### Size 10 first paint vs re-bake (D-20)

| Capture | firstDigest | rebakeDigest | equal |
| --- | --- | --- | --- |
| BEFORE | `764a4e1f` | `764a4e1f` | yes |
| AFTER | `5969a5db` | `5969a5db` | yes |

The digest moves between gates because the engine changed; within each gate the two independent bakes agree.

## The law as shipped

- **Spacing:** `spacing = spacing0` unless `s.tool === 'brush' && isBristleResponse(this.brush)` AND `0 < spacing0 < 1/this.dh`; then `spacing = 1/this.dh`.
- **Ink:** `amount *= spacing / spacing0` only when that branch was taken. Pinned exactly (`toBe`) in the unit suite at Size 1.
- **Guard:** `const step = spacing - s.carry`; `!(step > 0)` → one catch-up dab at the segment start and `continue` (or `break` when `!(spacing > 0)`).

## Untouched-law statement

- **One production file.** `Engine.ts` only: 5 hunks — `stampScripted`'s new 11th `amountScale` parameter, the `bristleStroke` predicate, the floor/ratio block, the loop guard, `stamp`'s new 10th `amountScale` parameter and the conditional multiply.
- **No supersampling change:** `BRISTLE_SAMPLE_TABLE`, `bristleSampleScale`, `samplingScale()` and `spacingFrac()` are untouched; the only edit near them is `const amount` → `let amount` on the line that already divides by `this.samplingScale()`.
- **No subdivision change:** `fine` and `n` are untouched; the floor applies to the dab spacing only.
- **No shader/medium/preset change:** no `.glsl`/shader source, medium record, brush preset or payload field moved (diff audit below).
- **Scope through the existing predicate:** the engine contains `isBristleResponse(this.brush)` and no response-id string literal (pinned by source test).

## Guardrail audit (against the BEFORE `engineHead`)

```
$ git diff --name-only c39bcca98bb7d04f7ac207bf8d304d2222b391f4 -- packages/efx-watercolor/src app/src
packages/efx-watercolor/src/playground/Engine.ts
packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts
packages/efx-watercolor/src/playground/scattering.test.ts
```

Two paths were planned; the third is a one-line test-needle update forced by the plan's own `const`→`let` instruction (see Deviations). **Production-code scope remains exactly one file.** No shader file matched the audit filter.

## Verification gates

| Gate | Command | Result |
| --- | --- | --- |
| Probe identity gate | `node packages/efx-watercolor/probe/small-brush/run.mjs --gate after --out …/261121-w5n-AFTER.json --compare …/261121-w5n-BEFORE.json` | `RESULT: PASS` (20/20 lines) |
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | 39 files passed; 876 passed / 8 skipped (884) |
| App suite | `pnpm --dir app exec vitest run` | 464 files passed / 2 skipped; 9753 passed / 1 skipped / 96 todo (9850) |
| App types | `pnpm --dir app exec tsc --noEmit` | exit 0 |

## Why the probe sheet is 1080×1080

The floor is a device-pixel law, so the identity rows only measure an inert floor if the shipped spacing sits above one device pixel on the sheet. At dh 1080 the Size 30 and Size 100 spacings are 2.91 px and 1.78 px — comfortably above 1 px, so any engine change touching them shows up as a digest difference. At dh 600 a Size 100 Bristle Round would sit at 0.989 px and the floor would bind by 1 %, making the required byte-identity test unsatisfiable by construction. The probe reports `spacingPx` and `floorBinds` per case, so the evidence states this rather than assuming it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added engine-travel diagnostics to the frozen probe (before freezing)**
- **Found during:** Task 1
- **Issue:** The measured dab counts sat ~12 % below the plan's prediction. The plan required investigating the scene, not tuning the probe; the investigation needed the engine's own arc length, which the report could not show.
- **Fix:** Patched `WatercolorEngine.prototype.trace` in the probe to record `s.travelled`, and added `stampedPressure`, `spacingPxStamped` and `travelledPx` to every case. The plan had said to leave `trace` untouched; the patch is measurement-only (it delegates and reads one field), and it is present in BOTH captures, so the comparison stays instrument-for-instrument. Re-captured BEFORE afterwards, before committing the baseline.
- **Files modified:** `packages/efx-watercolor/probe/small-brush/probe.ts`, `…/run.mjs`
- **Verification:** counts reconcile exactly against `travelledPx / spacingPxStamped`
- **Committed in:** `eeaefd263` (Task 1 commit)

**2. [Rule 3 - Blocking] Followed the `let` declaration in the supersampling source pin**
- **Found during:** Task 3 (full package suite)
- **Issue:** `scattering.test.ts` pins the dab-amount line text-for-text as `const amount = … / this.samplingScale();`. The plan's own Task 2 instruction changes that declaration to `let` so the floor can multiply the same amount, so the gate could not pass with the two planned files alone.
- **Fix:** Updated the needle to `let amount = …` and stated in a comment why the extra multiply exists (the mirror of the pinned divide, so wash per distance is unchanged). The pinned law itself is unchanged.
- **Files modified:** `packages/efx-watercolor/src/playground/scattering.test.ts` (1 line + comment)
- **Verification:** `pnpm --dir packages/efx-watercolor exec vitest run` → 39/39 files, 876 passed
- **Committed in:** `7d64aff46`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary; neither changes production scope (one measurement field set inside the probe, one test needle). The production diff stays exactly one file.

## Issues Encountered

- **`scripting` is a prototype getter** (`this.stroke?.pointerId === SCRIPT_POINTER`), not a writable field. The test seeds no `stroke`, which makes it false; seeding it directly throws a `TypeError`.
- **App-suite flake, unrelated:** the first two full `pnpm --dir app exec vitest run` runs each failed one test in `src/lib/physicPaintBridge.test.ts` (a 20 s bounded-wait timeout, then a different test in the same file). The file passes 186/186 in 2.3 s in isolation, and the third full run passed 9753 tests with exit 0. Load-induced timing sensitivity in a 466-file parallel run; no engine code is involved. Not fixed here (pre-existing, out of scope).
- The `[aquarelle-render-split] write failed ReferenceError: window is not defined` lines in the app suite are pre-existing console noise; the passing run exits 0.

## UAT — automated-ready (not "done")

The responsiveness claim is a live judgment the artist makes in the app; the probe pins the law on a fixed headless scene.

| Row | Surface | Expected | Result |
| --- | --- | --- | --- |
| (a) | Studio, acrylic Bristle Round/Flat at Size 1, 10 and 30 — draw a stroke | Responsive: no lag or stall at the small sizes (measured: one dab per device pixel instead of up to 2.5) | automated-ready |
| (b) | Same, Size 30 and Size 100 | Matches HEAD pixels (probe: dabs and both exported digests equal at both sizes) | automated-ready |
| (c) | A Size 10 stroke — re-bake the same recorded stroke | Same paint as its first paint (probe: parity equal in both gates) | automated-ready |

## Next Phase Readiness

- The floor and the guard are pinned by a WebGL-free suite and by a reusable probe with a frozen baseline; the probe directory can serve the next spacing-adjacent quick unchanged (it is a general size sweep with digests).
- Bristle Flat shares the predicate and the presets' `spacing`/`aspect` columns, so it inherits the floor; the probe covers the round response only (the flat tip's `BRISTLE_SAMPLE_TABLE` column was intentionally out of scope).

## Self-Check: PASSED

- `packages/efx-watercolor/probe/small-brush/index.html` FOUND
- `packages/efx-watercolor/probe/small-brush/probe.ts` FOUND
- `packages/efx-watercolor/probe/small-brush/run.mjs` FOUND
- `packages/efx-watercolor/src/playground/engineTraceSpacing.test.ts` FOUND
- `packages/efx-watercolor/src/playground/Engine.ts` FOUND
- `packages/efx-watercolor/src/playground/scattering.test.ts` FOUND
- `.planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-BEFORE.json` FOUND
- `.planning/quick/261121-w5n-in-v2-2-0-phase-64-fix-the-acrylic-small/evidence/261121-w5n-AFTER.json` FOUND
- Commit `eeaefd263` FOUND in HEAD history
- Commit `b14b7ebe6` FOUND in HEAD history
- Commit `7d64aff46` FOUND in HEAD history
- Commit `94c863894` FOUND in HEAD history
