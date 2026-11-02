---
phase: 55-efx-paint-host-engine-1-host-split
plan: 07
subsystem: packages/efx-paint-host
tags: [genericity, EngineAdapter, fake-engine-2, import-graph, bakeHost, HOST-04, D-05, D-06, D-07, D-08, D-21]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-06)
    provides: HostScriptRefusal codes + fail-closed Apply pins + StudioScriptEnvelope<P> envelope
provides:
  - "A5 automated pin: fake engine-2 record → play → bake with assertable pixels (HOST-04 / D-05 / D-06)"
  - "D-07 static import-graph pin — zero engine-1 types in the host"
  - "createBakeHost (Effect v4 bounded-turn queue, D-21) exported as the Phase 56 consumer API"
affects: [55-08, 56-efx-watercolor]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 13813
  tasks: 3
  commits: 3
  plan_head_before: 6600bbeb601b3753bd884d9c7762949e25320e49
  plan_head_after: 0aae681de1d8787d7e55acc3aec6608da129fb0f

# Tech tracking
tech-stack:
  added:
    - "effect 4.0.0-rc.115 (already-installed pin) as a packages/efx-paint-host dependency"
  patterns:
    - "Fake engine-2 stub: full EngineAdapter<P> (engineId + payloadCodec + live + bake) with recorded call log and deterministic tinted frames (D-06)"
    - "Import-graph pin: comment-stripped specifier walk + in-memory matcher self-test + live plant proof (D-07)"
    - "Bake host: ported finalizationQueue pattern without app lifecycle; BakeTurnMode 'abort-on-dispose' | 'flush-survives-navigation' encodes D-21's two semantics"

key-files:
  created:
    - app/src/efx-paint/host-split/fakeEngine2Fixture.ts
    - app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts
    - app/src/efx-paint/host-split/hostImportGraphContract.test.ts
    - packages/efx-paint-host/src/bake/bakeHost.ts
    - packages/efx-paint-host/src/bake/index.ts
    - packages/efx-paint-host/src/bake/bakeHost.test.ts
  modified:
    - packages/efx-paint-host/src/index.ts
    - packages/efx-paint-host/package.json
    - app/src/efx-paint/efxPaintCleanBreakContract.test.ts

key-decisions:
  - "A5 play path is ONE shape: AnimationPlayer on StudioStroke<P> + bake via applyStroke/stepTick*/captureFrame on the same stub — no second stroke shape (D-05/D-06)"
  - "FakeEngine2StrokePayload is its own vocab (wash/granulation/bleed/pigment) so it cannot be confused with engine-1 tool/params/physicsMode"
  - "Import-graph pin walks the WHOLE packages/efx-paint-host/src tree (superset of the five named public entries) so bake/ is covered the moment it lands"
  - "createBakeHost dispose() cancels only abort-on-dispose turns and does NOT bump the generation counter — a running flush-survives-navigation turn stays generation-valid (D-21)"
  - "effect 4.0.0-rc.115 reused as a host dependency (threat T-55-SC: already-installed pin, no new third-party package)"

patterns-established:
  - "BakeTurnMode on BakeHostTurn: 'abort-on-dispose' (PlayScript, default) vs 'flush-survives-navigation' (long cuisson) — the two D-21 semantics as an explicit contract"

requirements-completed: [HOST-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A5 automated pin: fake engine-2 record → play → bake on the ONE StudioStroke<P> shape with assertable tinted pixels (HOST-04 / D-05 / D-06)"
    requirement: "HOST-04"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts#round-trips record → play → bake on the ONE StudioStroke<P> shape with assertable pixels"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts#fixture file imports nothing from @efxlab/efx-physic-paint and carries no engine-1 stroke type"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts#payloadCodec.parse is fail-closed on foreign shapes and accepts the fake payload"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-07 static import-graph pin — host source resolves no import into an engine package, app/, or Preact (T-55-12)"
    requirement: "HOST-04"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostImportGraphContract.test.ts#host source resolves no import into an engine package, app/, or Preact"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostImportGraphContract.test.ts#detects a planted engine-1 import and a dynamic-import leak in sample source"
        status: pass
      - kind: other
        ref: "command: live plant of import { EfxPaintEngine } from '@efxlab/efx-physic-paint' into packages/efx-paint-host/src/index.ts → pin fails; restore → green"
        status: pass
    human_judgment: false
  - id: D3
    description: "createBakeHost — Effect v4 bounded-turn queue with dispose-abort and flush-survives-navigation semantics, worker-free and UI-free (D-21)"
    requirement: "HOST-04"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/bake/bakeHost.test.ts#PlayScript bake aborts on dispose: a cancelled turn never commits"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/bake/bakeHost.test.ts#flush-survives-navigation: a long cuisson bake completes across dispose"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/bake/bakeHost.test.ts#beginFlush exists and is exercised by flush()"
        status: pass
      - kind: other
        ref: "command: pnpm --filter @efxlab/efx-paint-host build (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 56 consumer deferral: createBakeHost exported from the host, no app/ bake path rewired (R1.3 no-behavior-change-at-seam)"
    verification: []
    human_judgment: true
    rationale: "Deliberate deferral recorded in this SUMMARY — PlayScript stays on finalizationQueue this phase; wiring createBakeHost is Phase 56 engine-2 scope. A verifier must confirm no app/ file imports createBakeHost yet (the deferral is the deliverable)."

# Metrics
duration: 25min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 07: Genericity End-to-End (A5 pin + import-graph + bake host) Summary

**Fake engine-2 round-trips record → play → bake on the one StudioStroke<P> shape with assertable pixels; D-07 import-graph pin locks zero engine-1 types in the host; createBakeHost ports the bounded-queue bake pattern worker-free (D-21)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-15T07:48:43Z
- **Completed:** 2026-10-15T08:13:33Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- A5 automated pin (D-05): a fake engine-2 payload rides the ONE `StudioStroke<P>` shape through the FULL `EngineAdapter<P>` plug point — AnimationPlayer play leg + applyStroke/stepTick*/captureFrame bake leg — and the test asserts the stub tint in the captured pixels
- D-07 static import-graph pin walks all of `packages/efx-paint-host/src` and fails on any import/dynamic-import resolving into `efx-physic-paint`, an engine package, `app/`, or Preact; proven by both an in-memory matcher self-test and a live plant-and-restore
- `createBakeHost` (D-21): Effect v4 bounded-turn queue with slot-pool concurrency, generation-stale commit guard, `beginFlush`, never-rejecting produce/commit — and the two bake semantics as explicit `BakeTurnMode` (`abort-on-dispose` for PlayScript, `flush-survives-navigation` for long cuisson)
- `efxPaintCleanBreakContract.test.ts` SCAN_ROOTS gains `packages/efx-paint-host/src` (PATTERNS gotcha 8)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end fake engine-2 record → play → bake — A5 automated pin** - `36e7a2fc` (feat)
2. **Task 2: Static import-graph pin — zero engine-1 types in the host** - `793fb544` (feat)
3. **Task 3: Port the bake-host pattern (bounded turns, no worker)** - `0aae681d` (feat)

## Files Created/Modified

- `app/src/efx-paint/host-split/fakeEngine2Fixture.ts` - Test-only stub `EngineAdapter<FakeEngine2StrokePayload>` + fake engine-2 payload (D-06/D-08)
- `app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts` - A5 automated pin: fake engine-2 record → play → bake
- `app/src/efx-paint/host-split/hostImportGraphContract.test.ts` - D-07 static import-graph pin
- `packages/efx-paint-host/src/bake/bakeHost.ts` - `createBakeHost` (Effect v4 bounded-turn queue, D-21)
- `packages/efx-paint-host/src/bake/index.ts` - Bake subpath export
- `packages/efx-paint-host/src/bake/bakeHost.test.ts` - D-21 unit contract (dispose-abort / flush-survives-navigation / queue guarantees)
- `packages/efx-paint-host/src/index.ts` - Re-exports createBakeHost
- `packages/efx-paint-host/package.json` - `effect` 4.0.0-rc.115 dependency (already-installed pin)
- `app/src/efx-paint/efxPaintCleanBreakContract.test.ts` - SCAN_ROOTS + `packages/efx-paint-host/src`

## Decisions Made

- **ONE stroke shape for the whole round-trip (D-05/D-06):** play = AnimationPlayer on `StudioStroke<P>`; bake = applyStroke → stepTick* → captureFrame on the same stub. No second stroke shape, no mapping that reads `P`.
- **FakeEngine2StrokePayload is its own vocab** (wash/granulation/bleed/pigment) — deliberately distinct from engine-1's tool/params/physicsMode so the fixture cannot accidentally couple to engine-1 types.
- **Import-graph pin walks the whole host source tree**, not just the five named public entries — a superset so `bake/` is covered the moment it lands, and a leak in any file is caught.
- **`dispose()` does not bump the generation counter** when it leaves flush-survives-navigation turns running — a running long-cuisson bake stays generation-valid across PlayScript dispose (the generation bump is scoped to turns actually cancelled).
- **`effect` 4.0.0-rc.115 reused** as a host dependency (threat T-55-SC: already-installed pin; no package-manager install of an unknown package).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import-graph dynamic-import plant self-invalidated the 55-09 residue pin**
- **Found during:** Task 3 (plan-level verification suite)
- **Issue:** `hostImportGraphContract.test.ts`'s dynamic-import self-test planted the literal `@efxlab/efx-physic-paint/animation` string. The 55-09 residue pin scans for that contiguous string and flagged the pin's own plant (comment-stripping preserves string literals).
- **Fix:** Build the planted specifier at runtime via `['@efxlab/efx-physic-paint', 'animation'].join('/')` so the literal never appears in source — the same idiom the residue pin itself uses.
- **Files modified:** `app/src/efx-paint/host-split/hostImportGraphContract.test.ts`
- **Verification:** Full 8-file suite green (54 tests) including `hostAnimationResidueContract.test.ts`
- **Committed in:** `0aae681d` (Task 3 commit)

**2. [Rule 2 - Missing Critical] bakeHost unit tests added to satisfy Task 3 acceptance**
- **Found during:** Task 3 (acceptance criteria require dispose-abort and beginFlush to be tested)
- **Issue:** The plan's `files_modified` for Task 3 listed only `bakeHost.ts` / `bake/index.ts` / `src/index.ts`, but the acceptance criteria say "dispose() aborts a PlayScript-type bake (tested in the genericity or a bakeHost unit case)" and "beginFlush exists and is exercised by a test case".
- **Fix:** Added `packages/efx-paint-host/src/bake/bakeHost.test.ts` (9 cases) covering both D-21 semantics plus the ported queue guarantees (bounded slots, generation-stale, never-rejecting produce/commit).
- **Files modified:** `packages/efx-paint-host/src/bake/bakeHost.test.ts`
- **Verification:** 9/9 bakeHost cases green; collected by both `pnpm --filter @efxlab/efx-paint-host test` and the app vitest include
- **Committed in:** `0aae681d` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical)
**Impact on plan:** Both necessary for correctness/acceptance. No scope creep.

## Issues Encountered

- AnimationPlayer's rAF tick is float-sensitive (`1000/fps`); advancing exactly `frameCount` ticks misses the last frame. Fixed by advancing `frameCount + 2`, matching `AnimationPlayer.test.ts`'s existing idiom (advance 18 for frameCount 16).
- `isTinted` initially ignored the stub's per-tick red-channel nudge; corrected to key on `lastTick % 8`.

## Phase 56 Consumer Deferral (explicit)

`createBakeHost` is the **Phase 56 consumer API**. No app/ bake path is rewired to it this phase (R1.3 no-behavior-change-at-seam). PlayScript bake deliberately stays on `finalizationQueue` — its existing dispose-abort / flush-survives-navigation semantics already match D-21. Wiring PlayScript through `createBakeHost` is Phase 56 engine-2 scope, explicitly out of this phase. The seam is not dangling: the host exports it and the unit tests pin its two semantics.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HOST-04 delivered: fake engine-2 round-trips through the host with assertable pixels and zero engine-1 types, pinned statically and at runtime
- Bake host pattern is ported worker-free (D-21); Phase 56 can consume `createBakeHost`
- Ready for 55-08 (phase-wide symbol inventory)

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- FOUND: packages/efx-paint-host/src/bake/bakeHost.ts
- FOUND: packages/efx-paint-host/src/bake/index.ts
- FOUND: packages/efx-paint-host/src/bake/bakeHost.test.ts
- FOUND: app/src/efx-paint/host-split/fakeEngine2Fixture.ts
- FOUND: app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts
- FOUND: app/src/efx-paint/host-split/hostImportGraphContract.test.ts
- FOUND: 36e7a2fc (Task 1)
- FOUND: 793fb544 (Task 2)
- FOUND: 0aae681d (Task 3)
- Plan verification: host build exit 0; genericity + import-graph pins 9/9 green
- Full guard suite: 8 files / 54 tests green (golden, residue, fail-closed, genericity, import-graph, clean-break, payload, bakeHost)
- Schema tests: 14/14 green
