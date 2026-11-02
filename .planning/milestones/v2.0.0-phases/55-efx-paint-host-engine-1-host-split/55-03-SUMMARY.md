---
phase: 55-efx-paint-host-engine-1-host-split
plan: 03
subsystem: packages
tags: [generic-contract, StudioScriptEnvelope, EngineAdapter, fail-closed-parse, HOST-02, payload, opaque-engine-slot]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-02)
    provides: StudioStroke<P> schedule contract + EngineAdapter seam + efx-paint-host workspace package
provides:
  - "Generic StudioScriptEnvelope<P> / EngineId / EngineAdapter<P> contracts in packages/efx-paint-host/src/script/payload.ts"
  - "Total fail-closed parseStudioScriptEnvelope in packages/efx-paint-host/src/script/parse.ts"
  - "Public type re-exports from packages/efx-paint-host/src/index.ts"
affects: [55-04, 55-05, 55-06, 55-07, 55-08, 55-09]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5119
  tasks: 2
  commits: 2
  plan_head_before: b0f99036ed7b8fa4f88c36b1a6b3630d0c52cbea
  plan_head_after: cc1f6ff08f42165f1a5ccad1bba50279ce10a4d2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE schedule-stroke contract: StudioStroke<P> re-exported from animation/types into script/payload.ts (one contract, not two)"
    - "EngineAdapter<P> as one plug point covering both live playback and bake (engineId + payloadCodec + AnimationPlayer surface + bake lifecycle)"
    - "Total pure parse: every named failure returns null; engine slot copied through untouched (host never reads P)"

key-files:
  created:
    - packages/efx-paint-host/src/script/payload.ts
    - packages/efx-paint-host/src/script/parse.ts
    - packages/efx-paint-host/src/script/index.ts
    - packages/efx-paint-host/src/script/payload.test.ts
  modified:
    - packages/efx-paint-host/src/index.ts

key-decisions:
  - "Script payload types re-export StudioStroke<P> / StudioPoint / StudioStrokeMotion from animation/types.ts (one schedule contract, not two — build on 55-02's shape)"
  - "EngineAdapter<P> defined in payload.ts with full surface (engineId + payloadCodec + live playback + bake) — wider than animation/types.ts's player-only interface; structural compatibility keeps AnimationPlayer working"
  - "parseStudioScriptEnvelope validates envelope fields only (kind, schemaVersion, engineId, id, name, timestamps) and checks presence of source/thumbnail/brushPack; strokes array passes through with engine slot untouched"
  - "Schema version fixed at 1 (exact match, fail-closed on any other value)"

patterns-established:
  - "Script envelope parse pattern: total, pure, null on named failure; engine slot never inspected"

requirements-completed: [HOST-01, HOST-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Generic StudioStroke<P> / StudioScriptEnvelope<P> / EngineAdapter<P> / EngineId contracts in efx-paint-host, compiling at P = unknown with zero engine-1 imports"
    requirement: "HOST-02"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#StudioStroke<unknown> accepts a synthetic stroke with an opaque engine slot"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#EngineAdapter<unknown> exposes the one plug-point surface"
        status: pass
    human_judgment: false
  - id: D2
    description: "Total fail-closed parseStudioScriptEnvelope returning null on every named failure without throwing; engine slot copied through unchanged"
    requirement: "HOST-02"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#round-trips shared fields including recordedOrder and playFrame"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#leaves the engine slot byte-identical (host never reads P)"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#returns null on %s without throwing (12 named failure cases)"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/script/payload.test.ts#round-trips the shared stroke shape"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 03: Generic Payload Contract and Fail-Closed Parse Summary

**Generic StudioScriptEnvelope<P> / EngineAdapter<P> / fail-closed parseStudioScriptEnvelope with P opaque end to end (HOST-02 / D-19)**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-15T06:00:39Z
- **Completed:** 2026-10-15T06:21:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Generic `StudioScriptEnvelope<P>` / `EngineId` / `EngineAdapter<P>` contracts live in `packages/efx-paint-host/src/script/payload.ts`, compiling at `P = unknown` with zero engine-1 imports
- `EngineAdapter<P>` is ONE plug point covering both live playback and bake (engineId + payloadCodec + AnimationPlayer surface + bake lifecycle)
- `parseStudioScriptEnvelope` is total and pure: every named failure returns null and never throws; engine slot copied through untouched (host never reads P)
- `recordedOrder` and `playFrame` ride the shared stroke shape as host-owned schedule anchors so animation schedules never read P
- Envelope carries `kind: 'efx-studio-paint-script'`, `schemaVersion`, `engineId` (package identities), id/name/timestamps, source/thumbnail/brushPack, strokes

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `a57b8ecf` test(55-03): add failing test for generic payload contract and fail-closed parse | RED_EVIDENCE_OK |
| GREEN | `cc1f6ff0` feat(55-03): implement generic payload contract and fail-closed parse | 17/17 pass |
| REFACTOR | — | Not needed |

**RED evidence:** 15 tests failed on `./parse must export parseStudioScriptEnvelope: expected undefined to be type of 'function'` (missing-module assertion, not a syntax/collection error). 2 type-level tests passed as expected (they assert type shape, not parse). 1 test file collected (17 tests). Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`).

**Semantic assessment:** Target test executed and failed on the planned assertion — parseStudioScriptEnvelope is undefined because ./parse does not exist yet. All 15 failing tests name the missing parse export. Not a syntax error, not a collection error, not a fixture crash.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED: generic payload contract and fail-closed parse** - `a57b8ecf` (test)
2. **Task 2: GREEN: implement payload.ts + parse.ts to the behavior contract** - `cc1f6ff0` (feat)

**Plan metadata:** `pending` (docs: complete plan)

_Note: TDD tasks follow the RED → GREEN commit-scope contract._

## Files Created/Modified
- `packages/efx-paint-host/src/script/payload.ts` - Generic StudioScriptEnvelope<P>, EngineId, EngineAdapter<P>, source/thumbnail/brushPack shapes; re-exports StudioStroke<P> from animation/types
- `packages/efx-paint-host/src/script/parse.ts` - Total pure parseStudioScriptEnvelope: null on every named failure, engine slot untouched
- `packages/efx-paint-host/src/script/index.ts` - Re-exports from payload.ts + parse.ts
- `packages/efx-paint-host/src/script/payload.test.ts` - 17 tests: type-level assertions, round-trip, named failures
- `packages/efx-paint-host/src/index.ts` - Re-exports public types and parse from ./script

## Decisions Made
- Script payload types re-export StudioStroke<P> from animation/types.ts (one schedule contract, not two — build on 55-02's shape)
- EngineAdapter<P> defined in payload.ts with full surface (engineId + payloadCodec + live + bake); wider than animation/types.ts's player-only interface
- parseStudioScriptEnvelope validates envelope fields only and checks presence of source/thumbnail/brushPack; strokes pass through with engine slot untouched
- Schema version fixed at 1 (exact match, fail-closed)

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered
None - all tests green on first GREEN run; typecheck clean; prohibition grep clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Generic payload/envelope/adapter contracts and fail-closed parse are green under TDD with P opaque end to end
- 55-04 (engine-1 payload codec) can build on the envelope shape
- 55-07 (fake engine-2 stub) can implement EngineAdapter<P> against this surface
- 4 pre-existing test failures (physicsPaintRotoScriptClipboard, physicsPaintRotoRevealBake, physicsPaintRotoPlayScriptRenderer, physicsPaintRotoRegistryOwnership) are unrelated to this plan — they mock `@efxlab/efx-paint-host/animation` and were failing before this plan

## Self-Check: PASSED

- FOUND: packages/efx-paint-host/src/script/payload.ts
- FOUND: packages/efx-paint-host/src/script/parse.ts
- FOUND: packages/efx-paint-host/src/script/payload.test.ts
- FOUND: packages/efx-paint-host/src/script/index.ts
- FOUND: a57b8ecf (RED commit)
- FOUND: cc1f6ff0 (GREEN commit)
- PASS: typecheck exits 0
- PASS: 17/17 payload tests green
- PASS: prohibition grep clean (no engine-1 vocab tokens in script/)

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*
