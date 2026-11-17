---
phase: 64-medium-engine
plan: 06
subsystem: rendering
tags: [watercolor, webgl2, body, cover-pass, lift-program, undo-protection, preact-signals, tdd, pixel-gate]

# Dependency graph
requires:
  - phase: 64-01
    provides: the committed neutral-identity pixel baseline and the medium-engine probe harness (paper, transparent and white exports digested)
  - phase: 64-02
    provides: the canonical `body` key in the aquarelle params bag, its ONE mapping into the engine params (divided by 100, clamped, non-finite to 0) and `DEFAULT_AQUARELLE_PARAMS.body = 0`
  - phase: 64-03
    provides: the relief target, `bindFootprint`, `drawRelief` and the probe `--emboss` knob
  - phase: 64-04
    provides: the lit thickness channel and the `compare.mjs --differs-from` mode (committed baseline first)
provides:
  - the one Body law module `scattering.ts` (`BODY_CURVE_EXPONENT = 6`, `bodyCurve`) that 64-08 extends with the scattering deposit
  - `Engine.coverPass` reusing the registered Lift program and the shared footprint binding, drawing `fixed` then `relief`
  - the `coverAmount = bodyCurve(P.body)` guard and the once-per-stamp dual pool protection (pool 0 via `touch`, pool 1 via `history.protect`)
  - the `Body` globals row completing the ten-row Paint tab between Viscosity and Emboss, with its record-path pins
  - the probe `--body <0..100>` and `--scenario cover` knobs plus the `bakeMs` report line
  - byte-identity evidence: no-body neutral gate equals the committed pre-milestone baseline; Body 100 over a settled dark band changes all three exports; a repeat run is byte-identical
affects: [64-08, 64-09, 64-10, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 16267
  tasks: 3
  commits: 5
plan_head_before: 915dec6341331e86d02a238ae19a6e8ef3b80244
plan_head_after: f2cbe20c403a23ee52514a3b155e10b25b1f15a1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One perceptual curve per knob: `bodyCurve(body) = clamp01(body)^BODY_CURVE_EXPONENT` (exponent 6) declared once in `scattering.ts`, shared by the cover pass and (later) scattering — never a second inline curve"
    - "Cover by re-use: the cover pass binds the already-registered Lift program with the stroke's own footprint, draws `fixed` then `relief` with `FUNC_ADD` + `(ZERO, ONE_MINUS_SRC_COLOR)`, and allocates nothing"
    - "Order-term undo safety: both history pools are protected ONCE per stamp, before the first cover draw, on a stamp-wide rect — the deposit's own `touch()` runs too late"
    - "Backstop decomposition: the cover amount is `bodyCurve(P.body)` (render path), not a param clamp, so the identity at Body 0 is structural and byte-provable"

key-files:
  created:
    - packages/efx-watercolor/src/playground/scattering.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts
    - .planning/phases/64-medium-engine/64-06-red-evidence-task1.json
    - .planning/phases/64-medium-engine/64-06-red-evidence-task2.json
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs

key-decisions:
  - "`bodyCurve` is the sixth power, not the identity and not spec 06 §3's inline min-of-one clamp: a flat clamp accumulates multiplicatively to a full cover within a handful of dabs, while 0.5^6 = 0.015625 keeps Body 50 a glaze and 1^6 = 1 reaches a true cover at the tip core (D-14)"
  - "`coverPass` takes the dab's `dryness` and `grainThr` as two extra arguments so the shared `bindFootprint` call is fed the dab's own values — the plan's prose signature was `(x, y, r, angle, amount)` but the same paragraph mandates the grain arguments"
  - "`coverPass` is placed after `brushInk` and before `brushWet` so relief.test.ts's `brushRelief → brushInk` source slice stays exact; the call site, not the method position, satisfies the before-deposit ordering"
  - "`liftFS` needs no paper-tooth gate: the cover pass takes the erase shape as-is and never equalises it with `stampFS`; the guardrail against a halo is the shared footprint binding"
  - "The cover pass protects via `touch(coverRect)` (pool 0) and `history.protect(1, coverRect ± PROTECT_MARGIN, this.fixed.views)` (pool 1) once per stamp — never per dab, never inside `coverPass`"
  - "The probe's neutral scenario is byte-for-byte the plan-01 script: `--body`/`--scenario` are additive operands and an absent knob writes no key, so the committed baseline stays the gate's own target"

patterns-established:
  - "Cover pass: guard once (`coverAmount > 0`), protect twice per stamp, draw twice per dab before `brushInk`"
  - "Two-stroke probe scenario (`cover`): dark band fixed dry, then a light diagonal crossing it — the same params on both strokes so the only operand is `body`"
  - "Bake cost measured as `bakeMs` (script + settle, exports excluded) and compared as median over equal run counts"

requirements-completed: [MED-19, MED-20, MED-21, MED-22, MED-23, MED-24, MED-25]

coverage:
  - id: D1
    description: "The one Body law: `BODY_CURVE_EXPONENT = 6`, `bodyCurve` = `Math.pow(clamp01(body), BODY_CURVE_EXPONENT)`, 0/0.5/1 → 0/0.015625/1, monotone across 0..1 in 0.005 steps, clamps below 0 and above 1, non-finite → 0, single declaration, imports nothing from the engine, barrel untouched"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/scattering.test.ts#the one Body curve (D-14 / MED-21)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cover pass runs before the dab deposits, binds the Lift program with the shared footprint at `uRound = 0`, draws `fixed` then `relief` and never `ink`/`wet`, uses `FUNC_ADD` + `(ZERO, ONE_MINUS_SRC_COLOR)`, and leaves water/pen/lift branches and `lift()` untouched"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the Body cover pass (spec 06 / MED-19..MED-22)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/relief.test.ts + shaders.test.ts (unchanged slices still green)"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --differs-from cover-off"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both pools are protected once per stamp on a stamp-wide rect (dab radius grown by size jitter and scatter), before every dab — pool 0 via `touch`, pool 1 via `history.protect(1, …, this.fixed.views)` expanded by PROTECT_MARGIN and clamped to the doc; Body 0 takes neither call"
    requirement: MED-24
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#protects both pools once per stamp, on a stamp-wide rect, before every dab"
        status: pass
    human_judgment: false
  - id: D4
    description: "Body 0 / absent key is byte-identical to the pre-milestone baseline on all three exports; Body 100 over a settled dark band differs on all three; a repeat Body-100 run is byte-identical"
    requirement: MED-20
    verification:
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --differs-from cover-off"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --other cover-on-repeat"
        status: pass
    human_judgment: false
  - id: D5
    description: "Body is the tenth globals row, ninth in D-07's order between Viscosity and Emboss, moving the canonical key through `setAquarelleParam` on change and the release-commit path; Reset writes Body 0 and still never writes `size` or `lift`"
    requirement: MED-19
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#renders ten slider rows below the dropdown, Body ninth and Emboss last"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#moves the canonical body key through the one seam on change and release"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D6
    description: "The record path carries Body: `snapshotAquarelleRecord` includes it, an absent or non-finite value maps to engine 0 and an overshoot clamps to 1 through `toEngineParams`, and `updateAquarelleStrokesInScript` accepts a body patch instead of refusing the batch"
    requirement: MED-23
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.test.ts#Phase 64 Body record path (MED-23)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/mediumSelection.test.ts (shared bag unchanged)"
        status: pass
    human_judgment: false
  - id: D7
    description: "No new render target, texture or program: `coverPass` reuses `this.programs.lift`, and the bake median at Body 100 is within a few ms of Body 0 on the same scene"
    requirement: MED-25
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#reuses the Lift program through the shared footprint with uRound = 0"
        status: pass
      - kind: integration
        ref: "3x `--scenario cover --body 0` vs 3x `--scenario cover --body 100`: bake median 33 ms → 38 ms (+5 ms, +15%) on 256x256"
        status: pass
    human_judgment: false
  - id: D8
    description: "Live undo after a covering stroke restores both the dark area and its thickness exactly, and redo restores the covering stroke exactly"
    requirement: MED-24
    verification: []
    human_judgment: true
    rationale: "The probe cannot drive history — no automated run can exercise undo/redo on the live sheet. The structural half (dual protection before the first cover draw) is pinned by D3; the behavioural half is a human UAT row."

# Metrics
duration: ~11m
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 06: Medium Engine — Body cover pass and the Body row Summary

**A brush stroke can now replace the settled paint under its own tip before it deposits, with Body absent/0 proving byte-identity against the pre-milestone baseline and Body 100 replacing a fixed dark band on all three exports**

## Performance

- **Duration:** ~11m
- **Started:** 2026-11-17T15:56:32Z
- **Completed:** 2026-11-17T16:07:20Z
- **Tasks:** 3
- **Files modified:** 6 product/test files created or modified (plus two committed RED evidence records)

## Accomplishments

- `scattering.ts` declares the phase's ONE Body law: `BODY_CURVE_EXPONENT = 6` and `bodyCurve(body) = Math.pow(clamp01(body), 6)` with `Number.isFinite` mapping to 0. The module header records why the curve is not the identity (a flat amount erodes multiplicatively to a full cover within a handful of dabs), that D-14 supersedes spec 06 §3's inline `Math.min(1, P.body)` clamp, and that 64-08 extends this module rather than declaring a second curve. The barrel is untouched by design.
- `Engine.coverPass(x, y, r, angle, amount, grain, grainThr)` binds the already-registered Lift program through the shared `bindFootprint` (same tip texture, aspect, texture rotation, axis, `uRound = 0`), sets `uAmount`, enables `BLEND` with `FUNC_ADD` + `(ZERO, ONE_MINUS_SRC_COLOR)`, draws `this.fixed` then `this.relief`, and disables blending — no new program, target, texture or allocation.
- `case 'brush'` computes `const coverAmount = bodyCurve(P.body)` and, only when `coverAmount > 0`, takes the two stamp-wide protections before `this.eachDab(...)`: `this.touch(coverRect)` for pool 0 and `this.history.protect(1, coverRect expanded by PROTECT_MARGIN and clamped to the doc, this.fixed.views)` for pool 1. Inside the callback the cover draw precedes `this.brushInk(...)` per dab. The ordering hazard is recorded in a comment: the deposit's own `touch()` comes too late to restore a thickness the cover pass already eroded.
- The Paint tab now renders ten global rows, `Body` ninth between `Viscosity` and `Emboss`, driving the canonical `body` key through `setAquarelleParam` on change and the release-commit seam; Reset writes Body 0 through the one batch and never writes `size` or `lift`.
- The record path is pinned end to end: the snapshot carries `body`, absent/NaN/Infinity map to engine 0, an overshoot clamps to 1, and `updateAquarelleStrokesInScript` accepts a `{ params: { body } }` patch.
- The probe gained `--body <0..100>` (folded into EVERY stroke's bag) and `--scenario cover` (dark band fixed dry, then a light diagonal crossing it), plus a `bakeMs` line; the gate matrix proves the no-body identity, the Body-100 replacement, replay determinism and the bake delta in real headless-WebGL2 Chrome.

## Task Commits

Each task was committed atomically:

1. **Task 1: The shared Body curve and the cover pass (RED)** - `40b9ea343` (test)
2. **Task 1: The shared Body curve and the cover pass (GREEN)** - `d64dc131d` (feat)
3. **Task 2: The Body row and its record-path pins (RED)** - `98bd9be58` (test)
4. **Task 2: The Body row and its record-path pins (GREEN)** - `3ccc77de1` (feat)
5. **Task 3: Prove Body 0 is inert and Body 100 replaces** - `f2cbe20c4` (feat)

_Note: Tasks 1 and 2 were TDD tasks, so each has the test → feat pair. No REFACTOR commit was needed._

## Files Created/Modified

- `packages/efx-watercolor/src/playground/scattering.ts` - the one Body law (`BODY_CURVE_EXPONENT = 6`, `bodyCurve`, local `clamp01`) and its header settling D-14, spec 06 §3's superseded clamp and 64-08's extension
- `packages/efx-watercolor/src/playground/scattering.test.ts` - band values, monotonicity, clamping, non-finite input, single-declaration/no-engine-import and D-14 pins
- `packages/efx-watercolor/src/playground/coverage.test.ts` - 8 source-scan tests over `Engine.ts`: guard wrap, once-per-stamp dual protection before every dab, cover-before-ink ordering, Lift reuse with `uRound = 0`, fixed-then-relief draws, the multiplicative blend pair, untouched water/pen/lift paths and `lift()` lines, and the untouched barrel
- `packages/efx-watercolor/src/playground/Engine.ts` - the `bodyCurve` import, `const coverAmount = bodyCurve(P.body);`, the guarded dual protection before `eachDab`, the per-dab `coverPass` call before `brushInk`, and the `coverPass` method placed after `brushInk`/before `brushWet`
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` - `{ key: 'body', label: 'Body' }` inserted into `GLOBAL_ROWS` between Viscosity and Emboss (ten rows); header/row comments updated
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` - ten labels with Body ninth, Reset covers body at 0, the one-line `expectGlobalOrder` helper, the Body change/release test, and the ten-key Reset batch assertion
- `app/src/components/physic-paint/view/aquarelleRecordState.test.ts` - the `Phase 64 Body record path (MED-23)` describe: snapshot carries body, absent/non-finite/overshoot mapping, and the write-allowlist body patch
- `packages/efx-watercolor/probe/medium-engine/probe.ts` - `ScriptEntry`/`paramsBag`/`makeStroke` refactor, `neutralScript`/`coverScript`, `--body` and `--scenario` readers, scenario-aware `run(...)` with `bakeMs`, and the report's `scenario`/`body`/`bakeMs` fields
- `packages/efx-watercolor/probe/medium-engine/run.mjs` - `--body <0..100>` and `--scenario cover` parsing, page-query pass-through and summary lines
- `.planning/phases/64-medium-engine/64-06-red-evidence-task1.json` / `...-task2.json` - the validated RED evidence records

## Decisions Made

- **Sixth power, not identity, not a flat clamp.** `bodyCurve(0.5) = 0.015625` keeps Body 50 a glaze while `bodyCurve(1) = 1` reaches a true cover at the tip core; a flat clamp would accumulate multiplicatively to a full cover within a handful of dabs, contradicting D-14 and success criterion 5.
- **Seven-argument `coverPass`.** The plan's prose names `coverPass(x, y, r, angle, amount)` but the same paragraph requires `bindFootprint(..., 0, dryness, grainThr)` with the dab's own grain values, so the signature carries `grain` and `grainThr`. This is the one signature deviation (see Deviations).
- **Method placement after `brushInk`.** `coverPass` sits between `brushInk` and `brushWet` so 64-03's relief.test.ts slice (`private brushRelief(` → `private brushInk(`) stays exact; the required ordering is proven at the call site, which is pinned on a lower line than `this.brushInk(`.
- **No paper-tooth gate on the cover draw.** `liftFS` declares none and giving it one would change the Lift tool's own erase; the guardrail against a halo is the shared footprint binding, and the deposit's own `uGrain` gate owns appearance.
- **Protection is per stamp, never per dab.** One `touch` (pool 0) and one `history.protect` (pool 1) on a rect grown by the largest size jitter and scatter; the method itself holds no `touch(`, pinned by source scan.
- **The probe's neutral path is untouched by construction.** `paramsBag` adds a key only when its knob is passed, so `--gate neutral-identity` with no operand writes exactly the plan-01 bag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `coverPass` takes the dab's grain values (7 arguments, not 5)**
- **Found during:** Task 1
- **Issue:** The plan's `<action>` describes a private `coverPass(x, y, r, angle, amount)` but in the same paragraph mandates `this.bindFootprint(this.programs.lift, x, y, r, angle, 0, dryness, grainThr)` with the dab's own grain values — the 5-argument signature cannot satisfy the mandated call.
- **Fix:** Implemented `private coverPass(x, y, r, angle, amount, grain, grainThr)` and the call site passes `dryness` and `grainThr`. The inert-grain rationale (liftFS declares no grain uniforms) is recorded in the method comment.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`
- **Commit:** `d64dc131d`

**2. [Rule 1 - Bug] `coverPass` placed after `brushInk`, not before it**
- **Found during:** Task 1 verification
- **Issue:** Placing the method between `brushRelief` and `brushInk` made 64-03's `relief.test.ts` slice (`sliceBetween('private brushRelief(', 'private brushInk(')`) include `coverPass`, whose doc comment matched the slice's forbidden `touch(` substring — the unchanged-slice guard for the relief deposit failed.
- **Fix:** Moved `coverPass` to between `brushInk` and `brushWet` and reworded its comment ("own undo protection comes too late") so no stale `touch(` substring leaks into the relief slice. The required before-deposit ordering is pinned at the call site instead.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`, `packages/efx-watercolor/src/playground/coverage.test.ts`
- **Commit:** `d64dc131d`

## TDD Gate Compliance

- RED: `40b9ea343` `test(64-06): add failing tests for the Body curve and the cover pass` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` on the captured record.
- GREEN: `d64dc131d` `feat(64-06): replace settled paint under the dab's own tip with Body` follows the RED commit.
- RED: `98bd9be58` `test(64-06): add failing tests for the Body row and its record path` — `RED_EVIDENCE_OK` (5 of 31 failing, all on their planned anchors).
- GREEN: `3ccc77de1` `feat(64-06): add the Body row between Viscosity and Emboss` follows.
- REFACTOR: not required.
- No gate violations.

## Probe matrix (headless Chrome, real WebGL2, 256x256, fixed seeded scripts)

| Gate | scenario | body | digestPaper | digestTransparent | digestWhite | bakeMs | Comparison | Result |
|------|----------|------|-------------|-------------------|-------------|--------|------------|--------|
| neutral-identity | neutral | (absent) | d2bd637a | 291d4a11 | 6ba88334 | 27 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |
| cover-off | cover | 0 | d573fa72 | b7614318 | 5218ffb8 | 35 | reference capture | captured |
| cover-on | cover | 100 | 4d9ac6c9 | 4f24c2ea | 9bf35e56 | 38 | `--differs-from cover-off` (same session) | PASS — all 3 digests differ |
| cover-on-repeat | cover | 100 | 4d9ac6c9 | 4f24c2ea | 9bf35e56 | 40 | `--other cover-on` (same session) | PASS — all 6 fields equal |
| cover-half | cover | 50 | a2fe2019 | 0e40bd12 | 03e21640 | 39 | glaze reference (differs from both 0 and 100) | captured |

Cost: bake medians over three runs per side — cover-off 33 ms (34/33/33), cover-on 38 ms (38/37/39): **+5 ms (+15 %)** for the extra multiplicative cover draw on every dab of the two-stroke 256x256 scene; the neutral single-stroke gate bakes in 27-28 ms.

Exact verify chain (passed end to end):
`node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate cover-off --scenario cover --body 0 && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate cover-on --scenario cover --body 100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --differs-from cover-off && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate cover-on-repeat --scenario cover --body 100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs cover-on --other cover-on-repeat && pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/coverage.test.ts src/determinismContract.test.ts`

## Issues Encountered

- **RED report format (Task 2).** `expect(ordered).toEqual([...GLOBAL_LABELS])` and a whole-patch `toEqual` dumped multi-line YAML `actual:`/`expected:` blocks, which the RED classifier rejected as `INVALID_RED` (`Non-TAP data`, `Malformed TAP`). Fixed with a one-line `expectGlobalOrder` helper (`order.join('|')`) and `JSON.stringify`/`ids.join(',')` comparisons; re-captured and revalidated to `RED_EVIDENCE_OK`.
- **`tsc` TS6133.** A `bodyStrokeFixture(mutationId)` parameter was unused; dropped it and updated the call site — `tsc --noEmit` exit 0.
- **Semicolon-free probe style.** The first edit anchor assumed trailing semicolons; `probe.ts` is deliberately semicolon-free, so the insertion was re-applied against the exact text. esbuild bundling caught nothing, and the gate matrix ran clean.

## UAT rows handed to the human (the probe cannot execute these)

1. **Undo after a covering stroke** restores BOTH the dark area and its thickness exactly (the eroded pool-0 region and the pool-1 fixed layer come back together). The probe cannot drive history — this row must not be silently dropped; the structural half (dual protection before the first cover draw) is pinned by D3.
2. **Redo restores the covering stroke** exactly, including the thickness erosion.

## Declared behaviours for the human UAT (not defects)

- **A light stroke over a still-wet dark area mixes with it instead of replacing it** — the cover pass draws `fixed` and `relief` only; standing water and mobile pigment are untouched (MED-22).
- **Body below 1 attenuates multiplicatively**, so it reads as a glaze, not a perceptual 50 % mix: Body 50 is `0.5^6 = 0.015625`, a subtle lightening, and only Body 100 reaches a true cover at the tip core (D-14).

## Known Stubs

None — no hardcoded empty values, placeholder text, mock data sources or skipped tests were introduced.

## Next Phase Readiness

- 64-08 extends `scattering.ts` with the scattering deposit and owns the package barrel entry; the module imports nothing from the engine and declares the only Body curve.
- 64-09 and 64-10 can consume `compare.mjs --differs-from`, the `--body`/`--scenario` probe operands and the `bakeMs` report line as documented.
- 64-07's light wiring is unrelated and untouched by this plan.
- The undo/redo and wet-mix rows above remain with the human UAT.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `scattering.ts`, `scattering.test.ts`, `coverage.test.ts`, `64-06-red-evidence-task1.json`, `64-06-red-evidence-task2.json`, `64-06-SUMMARY.md`
- Commits present and ancestors of HEAD: `40b9ea343`, `d64dc131d`, `98bd9be58`, `3ccc77de1`, `f2cbe20c4`
