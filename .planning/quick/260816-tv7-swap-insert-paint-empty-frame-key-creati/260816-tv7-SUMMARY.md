---
phase: quick-260816-tv7-swap-insert-paint-empty-frame-key-creati
plan: 01
subsystem: physics-paint-roto
tags: [roto, interpolation-breaks, key-rails, insert, paint, paste-key, resolver]

# Dependency graph
requires:
  - phase: 43.4
    provides: Key Rail derivation from incoming interpolation break ownership
provides:
  - Insert always creates a connected key (no incoming break), including in trailing empty space and inside intentional gaps where the right segment's break survives
  - Paint on an empty frame and the + Key action create a broken key owning a persistent incoming interpolation break (startsNewSegment paste-key flag)
  - Insert tooltip and success copy no longer describe Insert as starting a new interpolation segment
affects: [43.5, milestone v0.9.0 UAT]

# Actuals (#2632) — pairs with the plan's `estimate` (30000) to calibrate future estimates.
actuals:
  tokens: 6587    # chars/4 over the realized diff (26349 chars)
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "paste-key intent carries an optional startsNewSegment flag that routes through the existing resolver/coordinator/bridge machinery unchanged"
    - "Parent-side bridge validation mirrors the resolver's break collection contract exactly"

key-files:
  created: []
  modified:
    - app/src/types/physicPaint.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/lib/physicPaintBridge.ts

key-decisions:
  - "Insert never creates a break; it connects the new key to the nearest left segment and preserves any existing break on the right segment"
  - "Paint on an empty frame and + Key create a broken key via paste-key startsNewSegment: true, reusing the existing paste-to-empty machinery"
  - "The startsNewSegment flag serializes only when true so canonical undo/redo and save/reopen parity hold"

patterns-established:
  - "Empty-frame key-creation break semantics are owned by the resolver break collection; the parent bridge validation must mirror the resolver contract exactly"

requirements-completed: [QUICK-260816-TV7]

coverage:
  - id: D1
    description: "Insert on a genuinely-empty frame creates a connected key with no incoming break, in trailing empty space and inside intentional gaps, preserving the right segment's break"
    requirement: QUICK-260816-TV7
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#intentional incoming interpolation breaks > proposes one empty real key and one incoming break atomically"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#incoming interpolation break lifecycle > insert-empty-segment inside an intentional gap connects left and preserves the right break"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#useRotoTimelineActions contextual Insert > context-dispatches occupied and genuinely empty Insert targets"
        status: pass
    human_judgment: false
  - id: D2
    description: "Paint on an empty frame and the + Key action create a broken key with a persistent incoming break owned by the new key, starting its own Key Rail"
    requirement: QUICK-260816-TV7
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#incoming interpolation break lifecycle > paste-to-empty with startsNewSegment makes the new key own an incoming break"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#useRotoTimelineActions + Key (addEmptyKey) port > creates a real key at the destination frame with the supplied empty payload"
        status: pass
    human_judgment: false
  - id: D3
    description: "Copy/Paste stays connected; the startsNewSegment flag round-trips canonically through the serializer and guard"
    requirement: QUICK-260816-TV7
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#incoming interpolation break lifecycle > paste-to-empty without startsNewSegment stays connected (Copy/Paste regression)"
        status: pass
      - kind: unit
        ref: "app/src/types/physicPaint.test.ts#round-trips paste-key startsNewSegment and rejects a non-boolean flag"
        status: pass
    human_judgment: false
  - id: D4
    description: "Insert tooltip and success copy no longer describe Insert as starting a new interpolation segment"
    requirement: QUICK-260816-TV7
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#useRotoTimelineActions contextual Insert > publishes the exact empty-segment acceptance message"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#keeps one visible Insert label with the contextual enabled description and guarded reason path"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full suite green and typecheck pass; the six native acceptance rows are reported for user verification"
    requirement: QUICK-260816-TV7
    verification:
      - kind: unit
        ref: "pnpm --dir app exec vitest run (128 files, 2266 tests passed)"
        status: pass
      - kind: unit
        ref: "pnpm --dir app typecheck"
        status: pass
    human_judgment: true
    rationale: "The six native acceptance rows require live visual verification of the timeline rails, breaks, Undo/Redo, and save/reopen in the running app"

# Metrics
duration: 12min
completed: 2026-08-16
status: complete
---

# Quick 260816-tv7: Swap Insert-connects / Paint-breaks Summary

**Insert now always creates a connected key (no incoming break, preserving the right segment's break in gaps), while Paint on an empty frame and the + Key action create a broken key owning a persistent incoming interpolation break via a new paste-key `startsNewSegment` flag — with RED tests first and a green full suite.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-16T21:49:00Z
- **Completed:** 2026-08-16T22:01:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Insert on a genuinely-empty frame (trailing empty space or inside an intentional gap) creates a real key with NO incoming interpolation break; the key connects to the nearest left segment and any existing break on the right segment survives.
- Paint on an empty frame and the + Key action create a real key WITH a persistent incoming interpolation break owned by the new key, starting a new segment and therefore its own Key Rail.
- The `paste-key` intent gains an optional `startsNewSegment` flag that round-trips canonically through the serializer and guard, so Copy/Paste, the coordinator, the bridge, history, and status text stay untouched.
- Paint-on-empty promotion in `prepareRotoScriptTargetRef` routes through `addEmptyKey` so it inherits the broken-key contract.
- Insert tooltip and success copy no longer describe Insert as starting a new interpolation segment.
- RED tests first (4 failing assertions), then the swap, then a green full suite (128 files, 2266 tests) and typecheck.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests for the swapped break semantics** - `a5e6447d` (test)
2. **Task 2: Swap the break semantics and route paint-on-empty to broken-key creation** - `04df4c98` (feat)
3. **Task 3: Full suite green and native acceptance report** - `09f1d864` (fix)

**Plan metadata:** `6b408c8c` (docs: create plan — committed by the orchestrator)

## Files Created/Modified

- `app/src/types/physicPaint.ts` - Added `startsNewSegment?: boolean` to the `paste-key` intent member; guard accepts the boolean flag; serializer emits it only when true.
- `app/src/types/physicPaint.test.ts` - Serializer round-trip and guard tests for `startsNewSegment`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` - `createPhysicPaintRotoPasteKeyIntent` gains a 4th `startsNewSegment` parameter; `buildPasteCandidate` adds the new key to the break collection only under `startsNewSegment && destinationKeyId === null`; `buildInsertEmptySegmentCandidate` passes the break collection through unchanged.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` - RED assertion for Insert-connects; new tests for broken paste-to-empty, connected Copy/Paste regression, and gap insert preserving the right break.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `addEmptyKey` passes `startsNewSegment: true`; Insert tooltip and success copy updated.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` - RED assertions for contextual Insert, acceptance message, and + Key broken key.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Paint-on-empty promotion routes through `addEmptyKey`.
- `app/src/lib/physicPaintBridge.ts` - Parent-side `validateInsertEmptySegmentPhysicalDelta` now requires the incoming-break collection preserved exactly.
- `app/src/lib/physicPaintBridge.test.ts` - Updated insert-empty-segment assertions to the new contract.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` - Updated empty-segment break assertions to the new contract.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Source-contract test updated for the new Insert tooltip copy.

## Decisions Made

- Insert never creates a break; it connects the new key to the nearest left segment and preserves any existing break on the right segment (user-confirmed product decision).
- Paint on an empty frame and + Key create a broken key via `paste-key` with `startsNewSegment: true`, reusing the existing paste-to-empty machinery so the coordinator, bridge, history, and status text stay unchanged.
- The `startsNewSegment` flag serializes only when true so canonical undo/redo and save/reopen parity hold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Correctness] Parent-side bridge validation still enforced the old Insert-break contract**
- **Found during:** Task 3 (full suite run)
- **Issue:** `validateInsertEmptySegmentPhysicalDelta` in `app/src/lib/physicPaintBridge.ts` required the insert-empty-segment payload to add exactly its fresh identity to the incoming-break collection. After the swap, the resolver produces an unchanged collection, so every insert-empty-segment payload was rejected by the parent — the swap could not work end-to-end.
- **Fix:** Updated the validation to require the incoming-break collection preserved exactly (Insert adds no break, the right segment's break survives), mirroring the resolver contract.
- **Files modified:** app/src/lib/physicPaintBridge.ts
- **Verification:** Full suite green (128 files, 2266 tests) and typecheck pass.
- **Committed in:** 09f1d864 (Task 3 commit)

**2. [Rule 3 - Blocking] Stale test assertions on the old Insert-break contract**
- **Found during:** Task 3 (full suite run)
- **Issue:** `useRotoPhysicalEditCoordinator.test.ts` and `physicPaintBridge.test.ts` asserted that insert-empty-segment adds the fresh identity to the incoming-break collection.
- **Fix:** Updated the assertions to the new contract (collection preserved exactly).
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts, app/src/lib/physicPaintBridge.test.ts
- **Verification:** Full suite green.
- **Committed in:** 09f1d864 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 correctness, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary for the swap to work end-to-end and for the suite to stay green. No scope creep; no production behavior beyond the required contract alignment.

## Issues Encountered

- The plan's Task 2 file list did not include `app/src/lib/physicPaintBridge.ts`, but the swap changed the resolver's break contract and the parent-side bridge validation enforced the old contract, rejecting every insert-empty-segment. This was resolved as a Rule 1/2 auto-fix (documented above).

## Native Acceptance Report

The six native acceptance rows from the spec are reported for user verification:

1. **The three user examples behave exactly as specified:** `[0---4---8]` Insert at frame 6 stays connected (unchanged); Insert at frame 11 (trailing empty space) now connects `[0---4---8]--[11]`; Paint at frame 11 now creates a broken key `[0---4---8]  [11]`.
2. **Insert in an intentional gap connects left and never removes the right segment's break.**
3. **Paint in an intentional gap creates an isolated broken key; both surrounding breaks survive.**
4. **Interpolation Off/On preserves every break and gap.**
5. **Undo/Redo atomic for both gestures; save/reopen reproduces the exact segments and rails.**
6. **43.1/43.4 derivation, Scissor, drag, delete, and spacing behaviors unchanged.**

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The swap is behavior-only with no saved-project migration; existing documents, keys, and breaks are untouched.
- The `startsNewSegment` flag round-trips canonically so undo/redo and save/reopen reproduce the exact segments and rails.
- Ready for Phase 43.5 and the milestone v0.9.0 UAT once the six native acceptance rows pass live verification.

## Self-Check: PASSED

- SUMMARY.md exists at the expected path.
- Commits verified: `a5e6447d` (Task 1 RED), `04df4c98` (Task 2 swap), `09f1d864` (Task 3 fallout fixes).

---
*Phase: quick-260816-tv7-swap-insert-paint-empty-frame-key-creati*
*Completed: 2026-08-16*
