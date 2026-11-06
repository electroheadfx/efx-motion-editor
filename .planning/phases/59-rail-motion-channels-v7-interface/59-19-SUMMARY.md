---
phase: 59-rail-motion-channels-v7-interface
plan: 19
subsystem: ui
tags:
  - preact
  - motion-channels
  - loop-clips
  - gap-closure
  - tdd

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-03
    provides: railMotions on the physical document and its fail-closed parser
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-06
    provides: assignRailMotionRailViews and anchor-based binding for bare Key Rails
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-18
    provides: the wave-3 predecessor; rail-set copy stays on the no-resolver default
provides:
  - RailMotionRailViewSpanResolver structural type and createRailMotionViewSpanResolver(ranges)
  - optional 5th viewSpanResolver parameter on deriveRailMotionRailViews and assignRailMotionRailViews
  - "projection, row and hook wiring: infinite-rail views extend to the store-resolved loop end"
affects:
  - 59-VERIFICATION gap G2 (CR-04)
  - MOTN-06 and MOTN-07 infinite-rail assertions
  - later infinite-rail plans (59-20, 59-21) that read rail view spans

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 7620
  tasks: 3
  commits: 5
plan_head_before: cecbea8a1a0f9a4e69864b65a28e58c3abdcf6a0
plan_head_after: b9c7750aea6825c45bfd6c5d49a52b6fa1f8aeea

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "An injected structural resolver keeps a pure identity module free of store and document imports while still learning a resolved span."
  - "One resolved boundary feeds every consumer: the compositor, the lane and the gizmo each build views with the resolver derived from the same store context."
  - "A resolver result is combined with Math.max against the legacy fallback, so a missing or wrong answer degrades to current behaviour and can never shorten a span."

key-files:
  created:
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-19-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-19-task2.json
  modified:
    - app/src/components/physic-paint/roto/railMotionIdentity.ts
    - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/railMotionExportParity.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "The span resolver is injected as a structural type over { loopId, effectiveEnd }, built from structural.loopResolution.ranges, so railMotionIdentity.ts gains no import and stays pure."
  - "The resolver is consulted only in the repeat === 'infinity' branch and combined with Math.max against the single-occurrence fallback, so a missing or wrong answer degrades to today's behaviour and never shortens a view."
  - "The row and the hook read getTrackRotoResolutionContext(layerId, trackId)?.context.ranges instead of deriving a second boundary authority, so the compositor, the lane and the gizmo share one end."
  - "physicsPaintRotoRailSetCopy.ts keeps the no-resolver default: the copy path binds a bare Key Rail's railId by anchor, and a Loop Clip's motion is framed by loopId directly."

patterns-established:
  - "Pure span derivation: identity builders accept an optional resolver; callers inject structural facts and the default path is byte-identical."

requirements-completed:
  - MOTN-06
  - MOTN-07

coverage:
  - id: D1
    description: "deriveRailMotionRailViews / assignRailMotionRailViews extend an infinite Loop Clip's view to the injected structural end, while finite clips, bare Key Rails and the no-resolver default are unchanged; the resolver takes the maximum effectiveEnd per loopId and answers only finite positive integers"
    requirement: MOTN-06
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion rail view span resolver"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionIdentity.test.ts#extends an infinite clip view to the resolved end supplied by a structural resolver"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/railMotionIdentity.test.ts#never lets a resolver shorten an infinite clip below its single-occurrence end"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/railMotionIdentity.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The compositor's rail-motion projection supplies the resolver from structural.loopResolution.ranges, so an infinite rail's transform applies in a later cycle and at the last frame before the resolved end, and applies none at the half-open end"
    requirement: MOTN-06
    verification:
      - kind: unit
        ref: "src/lib/railMotionExportParity.test.ts#applies the infinite rail transform in a later cycle and at the resolved end minus one"
        status: pass
      - kind: unit
        ref: "src/lib/railMotionExportParity.test.ts#applies no transform at the resolved end (half-open span)"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/lib/railMotionExportParity.test.ts"
        status: pass
      - kind: other
        ref: "git diff --stat -- app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts (no change)"
        status: pass
    human_judgment: false
  - id: D3
    description: "readTrackRailMotionFacts and readActiveRailMotionState supply the same resolver from getTrackRotoResolutionContext: an infinite rail's lane spans the store-resolved end, a finite rail keeps its prior width, and cursor-inside-span stays true in a later cycle and turns false at the resolved end"
    requirement: MOTN-07
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#spans an infinite rail lane to the store-resolved end (59-19 G2/CR-04)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx#keeps a finite rail lane at its prior first-cycle width (59-19)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#keeps the rail span alive in a later cycle and ends it at the resolved end"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 19: Infinite-Rail Motion Span Summary

**An infinite Loop Clip's motion view now ends at the rail's structural resolved boundary, so the compositor applies its transform in every later cycle and the lane width and gizmo cursor gate agree on that same extended span.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-06T21:02:30Z
- **Completed:** 2026-11-06T21:08:45Z
- **Tasks:** 3
- **Files modified:** 8 code/test files plus 2 RED evidence artifacts

## Accomplishments

- Added `RailMotionRailViewSpanResolver` and `createRailMotionViewSpanResolver(ranges)` to `railMotionIdentity.ts`: the factory reduces ranges to the maximum `effectiveEnd` per `loopId` and answers only finite positive integers. The module gained no import and stays pure.
- Added an optional 5th `viewSpanResolver` parameter to `deriveRailMotionRailViews` and `assignRailMotionRailViews`; only the `repeat === 'infinity'` branch consults it, and `Math.max` against the single-occurrence fallback guarantees it can never shorten a view. With no resolver the output is byte-identical to before.
- `_resolveRotoRailMotionProjection` now builds the resolver once from `structural.loopResolution.ranges` — the same structural entry the projection memoizes on — so an infinite rail's transform is applied in cycle 2 and at `CAPACITY - 1`, and is absent at the half-open end `CAPACITY`.
- `readTrackRailMotionFacts` and `readActiveRailMotionState` supply the resolver from `getTrackRotoResolutionContext(layerId, trackId)?.context.ranges ?? []`, extending the motion lane to 600 cells in the fixture and keeping the gizmo's cursor-inside-span true past the first cycle, closing at the resolved end with the locked copy `Move the playhead inside this rail first.`
- Finite Loop Clips and bare Key Rails keep their exact prior spans and lane widths; `physicsPaintRotoRailSetCopy.ts` shows no diff.

## Task Commits

Each task was committed atomically (Tasks 1 and 2 are TDD: test → feat):

1. **Task 1 RED: failing injected-resolver pins** - `c4c2256f9` (test)
2. **Task 1 GREEN: injected infinite-rail view span resolver** - `5ab189fe4` (feat)
3. **Task 2 RED: failing infinite-rail transform parity rows** - `7b3e092bf` (test)
4. **Task 2 GREEN: compositor supplies the resolved span** - `54c34231e` (feat)
5. **Task 3: lane width and gizmo gate read the resolved span** - `b9c7750ae` (feat)

**Plan metadata:** committed after this SUMMARY (docs: complete infinite-rail motion span plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionIdentity.ts` — resolver type + factory; optional 5th parameter on both view builders; updated `railViewOccurrences` doc to name the single-occurrence result as the no-resolver fallback.
- `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — new `rail motion rail view span resolver` suite: max-per-loopId, finite-positive-integer answers, infinite extension, no-shortening guard, finite/Key Rail invariance, forwarding through `assignRailMotionRailViews`.
- `app/src/stores/physicPaintStore.ts` — `_resolveRotoRailMotionProjection` builds and forwards `createRailMotionViewSpanResolver(structural.loopResolution.ranges)`.
- `app/src/lib/railMotionExportParity.test.ts` — infinite progressive clip fixture (A@0/B@4 at capacity 600, rail frames 0/3) with transform rows at frame 6, `CAPACITY - 1`, and the half-open control at `CAPACITY`.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — `readTrackRailMotionFacts` reads the track resolution context and supplies the resolver.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — infinite lane spans the store-resolved end (600 cells × `cellPitch`); finite sibling lane keeps its prior width.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `readActiveRailMotionState` supplies the same resolver.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — cursor at 6 and `resolvedEnd - 1` keeps the command enabled; at `resolvedEnd` it disables with the locked reason copy.
- `red-evidence-59-19-task1.json`, `red-evidence-59-19-task2.json` — TAP RED evidence with classifier verdict `RED_EVIDENCE_OK`.

## Decisions Made

- The resolver is structural (`{ loopId, effectiveEnd }`) and injected, so `railMotionIdentity.ts` learns the real infinite duration without importing the physical resolver, the store or any document model.
- Only the infinite branch consults the resolver, and the result goes through `Math.max` against the fallback end: a wrong answer can never shorten a view, and a missing injection degrades to today's single-occurrence span rather than to an unbounded transform (T-59-55).
- The store, the row and the hook each derive the resolver from the store's own memoized resolution context rather than a second boundary authority, so the three surfaces cannot disagree about where motion exists.
- The copy path keeps the no-resolver default: it uses views only to bind a bare Key Rail's railId by anchor, and a Loop Clip's motion is framed by `loopId` directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. (Environment note: `gsd_run` is not on PATH in this shell; the project-local `./.claude/gsd-core/bin/gsd_run` was used throughout.)

## Known Stubs

None — the resolver is wired to the real store resolution context in all three consumers and covered by their tests.

## Threat Flags

None — no new network, auth or file-access surface. T-59-55 is mitigated structurally: structural injection, infinite-branch-only consultation, `Math.max` against the fallback, and the unchanged no-resolver default. T-59-SC: no install in this plan.

## TDD Gate Compliance

- **Task 1 RED:** `c4c2256f9` — target test `extends an infinite clip view to the resolved end supplied by a structural resolver` failed on its own assertion (`expected 13 to be 40`); 42 tests ran, 38 pass, 4 fail (the factory rows failed `expected 'undefined' to be 'function'` via a namespace `typeof` assertion, so the RED was an assertion, not a module-load error); classifier verdict `RED_EVIDENCE_OK` (reason `target_test_failed`).
- **Task 1 GREEN:** `5ab189fe4` — same command exits 0 with all 42 tests passing.
- **Task 2 RED:** `7b3e092bf` — target test `applies the infinite rail transform in a later cycle and at the resolved end minus one` failed because cycle 2 carried no transform (`expected undefined to be defined`); 14 tests ran, 13 pass; classifier verdict `RED_EVIDENCE_OK` (reason `target_test_failed`).
- **Task 2 GREEN:** `54c34231e` — same command exits 0 with all 14 tests passing.
- **Task 3:** declared `type="auto"` without `tdd="true"`; its row and hook tests were written first and failed before the wiring (219 existing tests passed), then passed after the wiring in `b9c7750ae`.

## Self-Check: PASSED

- Files exist: `railMotionIdentity.ts`, `railMotionIdentity.test.ts`, `physicPaintStore.ts`, `railMotionExportParity.test.ts`, `PhysicsPaintTrackRow.tsx`, `PhysicsPaintTrackRow.test.tsx`, `useRotoTimelineActions.ts`, `useRotoTimelineActions.test.ts`, both RED evidence JSONs.
- Commits `c4c2256f9`, `5ab189fe4`, `7b3e092bf`, `54c34231e`, `b9c7750ae` are ancestors of HEAD.
- Plan verification: four vitest files exit 0 (277 tests), typecheck exit 0, `createRailMotionViewSpanResolver` count 2 in each of store/row/hook, `physicsPaintRotoRailSetCopy.ts` unchanged.
