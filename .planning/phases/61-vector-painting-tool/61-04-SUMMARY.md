---
phase: 61-vector-painting-tool
plan: 04
subsystem: engine
tags:
  - watercolor
  - vector-path
  - per-sample-width
  - script-channel
  - scriptscale-c03
  - probe-measurement
  - tdd

# Dependency graph
requires:
  - phase: 61-01
    provides: "The feasibility probe harness (esbuild + headless Chrome + /tmp result extraction), the measured baseline that sizeMult() already reaches 1.75x, and the recorded scriptScale clamp at 1.0x that the channel must not route through"
  - phase: 61-02
    provides: "sampleVectorWidths / isUniformWidthProfile and the 0.2..2.0 ANCHOR_WIDTH range from the pure spine module"
  - phase: 61-03
    provides: "The persisted AquarelleStrokePayload.anchors sparse profile and its engine-block carrier"
provides:
  - "Engine.widthScale argument on scriptBegin/scriptMove and the per-sample Sample.w carrier"
  - "Stroke.widthFrom/widthTo ramp, widthFactorAt(s, fraction) interpolation, and sizeMult(widthFactor)"
  - "resolveStrokeWidthFactors(payload, pts): Float32Array | null — the one adapter bridge from sparse anchors to the deposit path"
  - "probe/vector-spine --scenario width — a real-pixel radius-ratio measurement through the adapter"
affects:
  - 61-05 (AQTL v2 must not encode the derived per-sample array; anchors stay the only persisted width data)
  - 61-09 (the path-edit overlay can reuse the same sparse factors; no engine-state width exists to rehydrate)
  - the live pointer path (pointerdown now queues w: 1, byte-identically)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 11443
  tasks: 3
  commits: 3
plan_head_before: a8b4b109e83fa26e6835c1a2b3b7bfd11d124944
plan_head_after: bece888992023ee80a8c3978cc255566760c79b0

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Data on the queue item, never on engine state: the width factor rides `Sample.w` and becomes the active Stroke's from/to pair on dequeue, so a late drain cannot stamp one sample with another's width"
  - "Interpolate the derived factor, not the source anchors: `widthFactorAt(s, fraction)` is a pure lerp of the two queued sample factors, held at both ends"
  - "One bridge, computed once per active stroke: `resolveStrokeWidthFactors` returns a Float32Array indexed by `active.index`; null means the feed passes the literal 1 and the pre-width deposit is byte-identical"
  - "Probe measurement has a resolution floor: the widest-row statistic at a 12px footprint is paper-grain-limited, so the width scenario pins a 32px canonical footprint where the ratio discriminates"
  - "Source-contract pins for call-site arguments the type system cannot see across a class boundary (both feed call sites end in `widthFactor)`; `scriptScale`'s assignment appears exactly once)"

key-files:
  created:
    - packages/efx-watercolor/src/playground/engineScriptWidth.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - packages/efx-watercolor/probe/vector-spine/probe.ts
    - packages/efx-watercolor/probe/vector-spine/run.mjs

key-decisions:
  - "The factor lives on the queued sample, not on a mutable engine field: a late queue drain must stamp each sample at its own width, and the plan's artifacts table row `private scriptWidth` is deliberately NOT implemented (the must-have truth and T-61-13 forbid it)."
  - "`sizeMult(widthFactor)` multiplies the existing expression and leaves the `this.scripting ? this.scriptScale : 1` term character-for-character untouched, closing C-03: any factor routed through scriptScale would cap at 1.0."
  - "The adapter resolves the factor array once at stroke activation (applyStroke / renderAllStrokes / renderPartialStrokes), never inside the tick loop; `active.widths === null` feeds the literal 1."
  - "The width probe paints at canonical size 32 (engine scale 1.0), not the default 12: at 12px the widest-row radius is grain-noise-limited (observed 1.6-1.75) and cannot discriminate the 1.7 gate; 32px measures 35px -> 60px = 1.714 deterministically."
  - "The committed phase-evidence file is left at its 61-01 bytes: the verification run regenerates only timing fields, and the pixels remain digest-identical (2058d0c6, 8,294,400 bytes)."

patterns-established:
  - "Non-GPU pins over engine internals seed a real prototype instance by hand (`Object.create(WatercolorEngine.prototype)`) instead of a parallel fake, so the pinned laws run on every machine while the real-pixel proof stays in the probe."
  - "A TDD pin task whose implementation pre-landed in its tracer produces RED with an uncommitted scratch stub, recorded honestly in the RED evidence rather than by reordering the commits."

requirements-completed: [VEC-03]

coverage:
  - id: D1
    description: "A 1.8x anchor factor reaches real pixels through the adapter path and measures at least 1.7x, while the scriptScale-clamped arm stays at 1.0x"
    requirement: VEC-03
    verification:
      - kind: probe
        ref: "packages/efx-watercolor/probe/vector-spine/run.mjs --scenario width"
        status: pass
    human_judgment: false
  - id: D2
    description: "The factor rides the queued sample and the stroke from/to ramp, interpolates between samples with held ends, and `scriptScale` keeps its assignment and its 1.0 cap"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/engineScriptWidth.test.ts#the queued sample carries its own width (61-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The adapter derives one Float32Array entry per point from sparse anchors, returns null without anchors or when uniform, holds out-of-range factors at the nearest published end, and feeds both script calls"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#resolveStrokeWidthFactors (61-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The uniform path is byte-identical: the full suite stays green and the phase evidence probe's pixel digests are unchanged"
    requirement: VEC-03
    verification:
      - kind: probe
        ref: "packages/efx-watercolor/probe/vector-spine/run.mjs (VECTOR-SPINE PASS, digestA=digestB=2058d0c6)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 04: Per-Sample Width Channel Summary

**A per-sample width factor rides the queued sample through the deposit path — a 1.8x anchor deposits 1.714x wider on measured pixels — while `scriptScale` and the uniform path stay untouched and byte-identical.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-10T13:05:31Z
- **Completed:** 2026-11-10T13:19:32Z
- **Tasks:** 3 (tracer + pin + verification)
- **Files created/modified:** 6 (1 created, 5 modified)

## Accomplishments

- The engine's deposit path now carries a width factor that can exceed 1.0: `scriptBegin`/`scriptMove` take an optional `widthScale` appended after the tilt pair, the queued `Sample` carries `w`, and the active `Stroke` ramps `widthFrom -> widthTo` on dequeue.
- `sizeMult(widthFactor)` multiplies the existing footprint by a factor interpolated between samples (`widthFactorAt`), and because `radius` is the source of both dab size and dab spacing, a wider stroke keeps its wash density. C-03 is closed: `this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;` remains exactly one assignment and one `Math.min(1, maxRadius` occurrence (`Engine.ts:866`).
- `resolveStrokeWidthFactors(payload, pts)` is the one bridge from 61-02's sparse spine: null without anchors or when uniform, otherwise a `Float32Array` of one factor per point built once per active stroke and indexed by `active.index`. Both feed call sites pass it, and the null path passes the literal 1.
- Real-pixel proof: `--scenario width` replays the same three-anchor stroke with every factor at 1 and with the middle anchor at 1.8 through `createAquarelleEngineAdapter`, measures widest-row radii of 35px and 60px, and emits `VECTOR-WIDTH PASS observed=1.714` (deterministic across two runs), while the probe's existing `scriptScale-clamped` arm still measures 10px -> 10px = 1.0x.
- The uniform path is untouched: the full engine suite is green and the phase evidence probe still reports `VECTOR-SPINE PASS` with `digestA = digestB = 2058d0c6`, `byteLength = 8,294,400`.

## Task Commits

1. **Task 1 RED: failing pin for the engine width channel** - `2c74a49ff` (test)
2. **Task 1 GREEN: carry the per-sample width factor through the deposit path** - `2b1da0d40` (feat — Engine.ts, engineAdapter.ts, probe.ts, run.mjs)
3. **Task 2 RED: pin the sparse width factor bridge** - `bece88899` (test — the derived-array truth table in engineAdapter.test.ts)

Task 3 is a verification pass with no new surface, so it has no code commit.

**Plan metadata:** included in the `docs(61-04)` completion commit.

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `sizeMult width factor (61-04 VEC-03) > multiplies the footprint by exactly the factor it is given (1.8x)`. 10 tests ran, 7 failed on assertions (sizeMult ratio, sample `w` enqueue/clamp, per-sample stamping, stroke ramp, dequeue source law, missing `widthFactorAt`). |
| Task 1 GREEN | `vitest run src/playground/engineScriptWidth.test.ts src/adapter/engineAdapter.test.ts` → 22 passed \| 8 skipped; committed as `feat`. Tracer feedback gate re-ran the automated verify: `VECTOR-WIDTH PASS observed=1.714` on two consecutive runs. |
| Task 2 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `resolveStrokeWidthFactors (61-04) > derives one Float32Array entry per point: authored maximum, held ends`. 27 tests ran, 4 failed on assertions with the helper neutralised by an uncommitted scratch stub. |
| Task 2 GREEN | Implementation pre-landed in Task 1 (`2b1da0d40`) because the tracer had to measure the channel; restoring it and running `vitest run src/adapter/engineAdapter.test.ts` → 19 passed \| 8 skipped. The RED commit `bece88899` carries tests only. |
| Task 3 | No TDD cycle — verification pass. Full suite, both probes, clamp count and app typecheck all pass (see Verification Run). |
| REFACTOR | Not needed — no cleanup beyond the in-cycle work. |

RED evidence records live in `.planning/phases/61-vector-painting-tool/.red-evidence/61-04-t1/` and `61-04-t2/` (untracked, as in 61-02, 61-03 and 61-08). The t2 record documents the scratch-stub method in `semanticAssessment`.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/Engine.ts` - `Sample.w`, `Stroke.widthFrom/widthTo`, `scriptWidthFactor` (clamp 0.2-2.0, non-finite -> 1), `widthScale` on `scriptBegin`/`scriptMove`, `sizeMult(widthFactor)`, `widthFactorAt`, and the `widthFactor` parameter threaded through `radius`, `brushRadius` and `stamp`; the dequeue ramp and the trace-loop interpolation
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - `resolveStrokeWidthFactors` export and the per-stroke `widths` cursor at all three activation sites (applyStroke, renderAllStrokes, renderPartialStrokes), feeding both script calls
- `packages/efx-watercolor/src/playground/engineScriptWidth.test.ts` - created: 10 non-GPU pins over a hand-seeded `WatercolorEngine.prototype` instance (sizeMult ratio, sample clamp truth table, per-sample stamping, ramp law, interpolation with held ends, C-03 prohibition and behavioral clamp)
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` - 7 new non-GPU pins for `resolveStrokeWidthFactors` (absent/empty, uniform, sparse array shape and maximum, determinism, one-point grid, out-of-range hold, source contract at both feed call sites); the existing 20 cases untouched
- `packages/efx-watercolor/probe/vector-spine/probe.ts` - `?scenario=width` branch with the base/scaled anchor arms, `WIDTH_SCENARIO_*` constants, and the `widthRatio` result writer
- `packages/efx-watercolor/probe/vector-spine/run.mjs` - `--scenario width` parsing, query string, `/tmp/vector-spine/width-result.json` output, and a width-specific guard/exit code that never rewrites the committed evidence

## Verification Run

- `pnpm --filter @efxlab/efx-watercolor exec vitest run` → 15 files, 277 passed | 8 skipped (GPU-only)
- `node packages/efx-watercolor/probe/vector-spine/run.mjs` → `VECTOR-SPINE PASS`; `digestA = digestB = 2058d0c6`, `byteLength = 8,294,400` (unchanged); width arm `scriptFactor(sizeMult) 12->21px observed=1.75`, `scriptScale-clamped 10->10px observed=1`
- `node packages/efx-watercolor/probe/vector-spine/run.mjs --scenario width` → `VECTOR-WIDTH PASS observed=1.714`, base 35px -> scaled 60px, identical across two runs
- `grep -n "Math.min(1, maxRadius" packages/efx-watercolor/src/playground/Engine.ts` → exactly one match (`:866`), assignment string unchanged
- `pnpm --filter efx-motion-editor run typecheck` → clean
- `git show --first-parent --diff-filter=D --name-only` on each of the three commits → no tracked file deleted
- Generated `probe.bundle.js` was removed after each probe run; the committed `result.json` was restored after the verification run because only non-deterministic timing fields changed.

### Engine symbols changed (Task 3 record)

`Sample.w` (new field); `Stroke.widthFrom`, `Stroke.widthTo` (new fields); `scriptWidthFactor(value)` (new module-local helper); `scriptBegin(..., widthScale = 1)` (new ninth parameter); `scriptMove(..., widthScale = 1)` (new seventh parameter); `sizeMult(widthFactor = 1)` (new parameter); `widthFactorAt(s, fraction)` (new private method); `radius(tool, pr, speed, widthFactor = 1)`, `brushRadius(pr, speed, widthFactor = 1)`, `stamp(..., widthFactor = 1)` (new parameters); the dequeue ramp in `processInput`; the interpolated factor in the `trace` dab loop; `w: 1` on the live `pushSample`.

**Why the factor cannot live on engine state:** the queue drains on the tick grid, so a mutable `scriptWidth` field would be overwritten by the next enqueued sample before earlier samples are stamped — a sample would then deposit at a later neighbour's width. Carrying `w` on each queued sample (and the from/to pair on the active stroke for interpolation) makes queue order the only width authority. This is why the artifacts-table row `private scriptWidth` is intentionally absent and pinned by a source scan.

## Decisions Made

- **Sample-carried factor, no engine field.** The truth "the factor travels on the sample, not on the engine's mutable state" overrides the artifacts-table row that named `private scriptWidth`; the pin asserts the identifier never appears.
- **`scriptScale` untouched.** `sizeMult` multiplies by the new factor beside the existing scriptScale term; the clamp assignment is pinned character-for-character and behaviorally (20 -> 1x, 5 -> 0.5x).
- **Derive once per active stroke.** `resolveStrokeWidthFactors` runs at activation and is indexed in the tick loop; a null result feeds the literal 1.
- **Probe footprint at canonical size 32.** 12px is grain-noise-limited (observed 1.6-1.75); 32px sits at engine scale 1.0 and measures 1.714, so the gate discriminates the channel rather than the paper.
- **Committed evidence untouched.** Only timing fields change between probe runs; the pixel digests are the invariant, so the 61-01 evidence file is restored rather than churned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness requirement] `private scriptWidth` is deliberately not implemented**
- **Found during:** Task 1
- **Issue:** The plan's "Artifacts this phase produces" table lists `private scriptWidth` as engine state, but the same plan's must-have truth ("the factor travels on the sample, not on the engine's mutable state") and threat T-61-13 forbid a mutable width field: a late queue drain would stamp samples with a later sample's width.
- **Fix:** The factor is carried by `Sample.w` and the active `Stroke.widthFrom/widthTo` pair only. `engineScriptWidth.test.ts` pins `ENGINE_SOURCE.includes('private scriptWidth') === false`, and the behavioral per-sample stamping test pins the intended law.
- **Files modified:** `Engine.ts`, `engineScriptWidth.test.ts`
- **Commit:** `2b1da0d40` (engine), `2c74a49ff` (pin)

**2. [Rule 3 - Blocking] Task 2's RED required an uncommitted scratch stub**
- **Found during:** Task 2
- **Issue:** Task 1 (the tracer) had to implement `resolveStrokeWidthFactors` to measure the channel end-to-end, so the pin task's helper already existed; its seven cases were green before the RED phase and could not produce a valid RED on their own.
- **Fix:** The helper body was temporarily neutralised (returning null) as an uncommitted scratch edit, the target test failed on its planned assertion (`expected null to be an instance of Float32Array`), the RED record was validated `RED_EVIDENCE_OK`, and the committed implementation was restored before the RED test commit. The GREEN for this task is Task 1's `2b1da0d40`; the `test(61-04)` commit carries no implementation diff. The method is stated in the RED record's `semanticAssessment`.
- **Files modified:** none committed by the stub.
- **Commit:** `bece88899`

**3. [Rule 3 - Blocking] New test file beyond the plan's files_modified**
- **Found during:** Task 1
- **Issue:** `files_modified` lists no playground-side test, but the tracer's `tdd="true"` cycle needs pins for engine internals that cannot run without a WebGL2 context through the adapter test.
- **Fix:** Created `engineScriptWidth.test.ts` with 10 non-GPU pins over a hand-seeded `WatercolorEngine.prototype` instance; it runs on every machine.
- **Files modified:** `packages/efx-watercolor/src/playground/engineScriptWidth.test.ts`
- **Commit:** `2c74a49ff`

---

**Total deviations:** 3 auto-fixed (1 Rule 2 correctness, 2 Rule 3 blocking)
**Impact on plan:** No scope change. Deviation 1 resolves an internal contradiction in the plan in favour of its stated truth; 2 and 3 are TDD execution mechanics. Every planned behaviour and acceptance criterion is asserted by committed tests or the measured probe.

## Issues Encountered

- The first width-probe measurement read 1.6, below the 1.7 gate: the widest-row statistic at a 12px footprint is limited by paper-grain noise (typical rows 18px vs a 20px widest row). A bundled scratch trace confirmed the channel itself was exact (sampled factors `[1, 1.2, 1.4, 1.6, 1.8, 1.6, 1.4, 1.2, 1]`, max stamped factor 1.7988), so the fix was measurement resolution, not the channel: the scenario now paints at canonical size 32 (engine scale 1.0) and reads 1.714 deterministically. All debug code was removed before commit.
- The `probe.bundle.js` esbuild artifact is not gitignored; it was deleted after every probe run so no generated file could be staged.
- None otherwise. No flaky arms, no unrelated failures, no pre-existing warnings touched.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The scratch RED stub was restored before the test commit, and no placeholder branch, hardcoded empty data or TODO remains in the changed files.

## Threat Surface

- T-61-11 (tampering via the width factor): both enqueue sites clamp into `ANCHOR_WIDTH_MIN..ANCHOR_WIDTH_MAX` and default a non-finite value to 1 through `scriptWidthFactor`; the clamp truth table (9 -> 2, 0.05 -> 0.2, NaN -> 1, Infinity -> 1) is pinned, and `scriptScale` is never reassigned from the factor.
- T-61-12 (per-tick allocation): the factor array is built once per active stroke and indexed by `active.index`; no allocation occurs in the tick loop, and the derivation is pinned deterministic across consecutive calls.
- T-61-13 (determinism regression): queue order alone determines the stamped width; the determinism contract suite (9 tests) stays green and the uniform-path probe digests are unchanged (`2058d0c6`).
- T-61-SC (package installs): none — no dependency added; the probe reuses the existing esbuild and Chrome discovery.
- No new network endpoint, auth path or file access pattern was introduced.

## Next Phase Readiness

- 61-05 (AQTL v2) must encode only `anchors` and the sparse factors; the derived `Float32Array` is replay-time state and must never be serialized.
- 61-06 (Rust side) has no width-channel work beyond the same two optional keys.
- 61-09 can render or edit paths using the sparse factors; no engine-state width exists to rehydrate, and a preview can call `resolveStrokeWidthFactors` on a candidate payload for an exact footprint.
- The live pointer path still queues `w: 1`, so hand-painted strokes and every pre-vector document deposit byte-identically.
- No blockers. VEC-03's automated proof is complete; the end-of-phase manual UAT rows belong to later plans.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All six plan files exist on disk (1 created, 5 modified).
- All three task commits (`2c74a49ff`, `2b1da0d40`, `bece88899`) are ancestors of HEAD.
- No commit deletes a tracked file.
- Full suite 277 passed | 8 skipped; both probes report PASS; clamp count is 1; typecheck clean.
