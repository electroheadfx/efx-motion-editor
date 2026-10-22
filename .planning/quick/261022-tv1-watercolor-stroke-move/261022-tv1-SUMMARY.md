---
phase: quick-261022-tv1
plan: 261022-tv1
subsystem: physic-paint
tags: [watercolor, aquarelle, stroke-move, undo, preact-signals, pointer-gesture]

# Dependency graph
requires:
  - quick: 261022-pim
    provides: watercolor stroke select surface, Alt+click delete, aquarelle-script ledger
provides:
  - Cmd/Meta+drag move of a recorded Water color stroke (ghost during drag)
  - document-UV translation of a recorded stroke + its payload-timeline entry
  - registry-aware aquarelle script snapshots (move undo/redo restores by reference)
  - one aquarelle-script ledger entry for move + re-bake
affects: [watercolor-script-editing, roto-script-replay, physical-edit-history]

actuals:
  tokens: 16226   # chars/4 over the realized diff (64902 chars), same scale as the estimate
  tasks: 2
  commits: 2
plan_head_before: 99a29b59015319b606bb565dc91b01cde69b15c7
plan_head_after: 649a924b86b5897316ab14c27e38913fe80d7270

tech-stack:
  added: []
  patterns:
    - Object-replacing script translation (snapshots keep live references)
    - Narrow leaf drag signal written in pointer handlers, read only by the overlay
    - One shared script-edit in-flight guard for delete and move

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts
  modified:
    - app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts
    - app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "A move replaces the stroke + timeline entry, never mutates them: snapshots hold live references, so in-place translation would move the captured before side."
  - "The aquarelle script snapshot now captures the stroke registry alongside the timeline; restore order is registry -> deleted membership -> timeline."
  - "Move and delete share one in-flight guard (delete-named exports remain aliases); no second async machine was introduced."
  - "The drag signal is written only in the overlay pointer handlers and read only by that leaf; no Studio or layer body subscribes."

patterns-established:
  - "Ghost-only gesture: pointermove writes only the drag signal; pointerup performs the script mutation + shared re-bake."
  - "Revision-authoritative before/after snapshots restore registry and timeline in lockstep by reference."

requirements-completed: []

coverage:
  - id: D1
    description: "Cmd/Meta+drag on a recorded stroke shows a ghost outline that follows the pointer; the sheet and script stay untouched during the gesture."
    verification: []
    human_judgment: true
    rationale: "Live canvas gesture and ghost rendering cannot be exercised by the node-env vitest harness; the user runs the Studio."
  - id: D2
    description: "Releasing a drag translates that stroke and its timeline entry, resets the sheet, and re-bakes through the shared Apply pipeline (progress pill, stroke at the new spot)."
    verification: []
    human_judgment: true
    rationale: "Visual bake/progress acceptance in the running WKWebView Studio; automated unit + source pins only prove the contract."
  - id: D3
    description: "Move + re-bake is ONE undo step: Cmd+Z restores the origin, Cmd+Shift+Z re-applies the move, each through the existing aquarelle-script ledger."
    verification: []
    human_judgment: true
    rationale: "End-to-end undo runs the live re-bake; the user confirms one press per direction in the Studio."
  - id: D4
    description: "Pure contract: UV/pixel delta mapping, object-replacing translation, registry+timeline snapshot restore, stale refusal, delete-after-move, in-flight refusal, drag signal idempotence."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts#261022-tv1 (10 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts#aquarelleEnginePixelDeltaToUv (2 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#261022-tv1 watercolor stroke move wiring (7 tests)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-22
status: complete
---

# Quick 261022-tv1: Water color stroke move Summary

**Cmd+drag on a recorded Water color stroke now shows a ghost, then translates the stroke and its script entry and re-bakes through the shared Apply path as one undoable `aquarelle-script` edit.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-22T19:35:00Z
- **Completed:** 2026-10-22T19:43:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added `aquarelleEnginePixelDeltaToUv`, the single pixel-delta -> document-UV crossing (exact inverse of the existing UV->pixel bridge, y flip included).
- Added `translateAquarelleStrokeInScript`: translates every stroke point and its payload-timeline entry by replacing both objects at the same timeline index, preserving ticks, recordedOrder, cuisson, traceSeed, playFrame, and the record clock.
- Extended aquarelle script snapshots with the recorded-stroke registry; restore order is registry -> deleted membership -> timeline, so move undo/redo restores the origin/moved objects by reference and a delete-after-move still splices the moved entry.
- Generalized the script-edit in-flight guard for delete and move (delete-named exports remain aliases), keeping one ledger, one cap, and one id counter.
- Added the drag gesture to the overlay leaf: pointer capture, 3 canvas-px threshold, ghost polyline + bbox at the live offset, pointercancel that applies nothing, and clearing on disarm/edit start. No effect, no component state; the drag signal is read only by this leaf.
- Wired `onMoveStroke` through `AquarelleCanvasLayer` and `PhysicsPaintCanvasMount`; the Studio handler mirrors the delete gates (peek-only), converts the delta once, begins the edit, resets the sheet, awaits `applyAquarelleTimeline`, records only on success, and rolls the raw snapshot back on failure with the same refusal message family.
- Updated the Select tooltip to name the drag and extended the Studio source pins (ordering, gates, mount plumbing, no ghost signal in the Studio render body).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): Cmd+drag stroke move — ghost, translate, shared re-bake, one undoable entry** - `5bc116a9` (feat)
2. **Task 2: gesture hardening, ledger/failure pins, tooltip, full gate report** - `649a924b` (test)

## Files Created/Modified

- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts` - added pixel-delta -> UV helper
- `app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts` - delta mapping + degenerate-sheet tests
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - registry snapshot/restore + object-replacing translation
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - drag signal, registry-aware snapshots, shared in-flight guard, `beginAquarelleMoveEdit`
- `app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts` - pure move/undo/redo/rollback/delete-lockstep contract (10 tests)
- `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx` - drag gesture, pointer capture/cancel, translated ghost
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - `onMoveStroke` prop + pass-through
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` - `onAquarelleMoveStroke` prop + ref pass-through
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `handleAquarelleMoveStroke` + canvas-mount memo wiring
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` - Select tooltip names the drag
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 261022-tv1 source pins; updated mounted-condition/tooltip/refusal-count pins

## Decisions Made

- A move replaces objects rather than mutating them, per the plan's snapshot reference law; this is what lets undo restore the origin and redo re-apply the moved side.
- The registry is captured inside the same `AquarelleScriptSnapshot`; restore order matters and is commented in `applySnapshotContent`.
- The gesture path adds no new async machine; it rides the delete path's gates and the clipboard controller's own invalidation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test typing required narrowing away the Dry union member**
- **Found during:** Task 1 (typecheck gate)
- **Issue:** Indexing `getRecordedAquarellePayloadTimeline()` yields `AquarellePayloadEvent` (stroke | Dry); the first draft of the move test accessed stroke fields directly and added 20 type errors (15 baseline -> 35).
- **Fix:** Added a `timelineStrokeAt()` helper that narrows with `'kind' in event` and returns the `toStudioStroke` return type; replaced `.at(-1)` with indexed access (repo TS lib target).
- **Files modified:** `app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts`
- **Verification:** `tsc --noEmit` returns exactly 15 errors, equal to the pre-edit baseline.
- **Committed in:** `5bc116a9` (Task 1 commit)

**2. Plan sequencing: the failed-re-bake rollback test landed in Task 1's test file**
- **Found during:** Task 1 test authoring
- **Issue:** Task 2 step 4 lists the rollback case, but the file's snapshot contract was being authored in Task 1.
- **Fix:** The rollback test was written with the other snapshot tests; Task 2 added the remaining step-4 items (in-flight refusal, disarm/edit ghost clearing).
- **Committed in:** `5bc116a9` (test) and `649a924b` (remaining cases)

**3. Existing pin updated for the new legitimate refusal site**
- **Found during:** Task 2 full pin run
- **Issue:** `quick-260922-al1` pins the `buildRotoScriptApplyRefusalMessage` mention count at 5; the move handler is a sixth legitimate call site (delete's fourth/fifth pattern).
- **Fix:** Bumped the pin to 6 with an explanatory comment; `handleAquarelleDeleteStroke` remains the fourth site.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** Studio suite 204/204 pass.
- **Committed in:** `649a924b` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed/sequencing (2 explicit, 1 pin update)
**Impact on plan:** No scope creep. All changes are within the planned files and contracts; the pin update is required by the new refusal site the plan mandates.

## Issues Encountered

- None blocking. Pre-existing full-suite failures (5 files) and 15 pre-existing typecheck errors are unchanged from the baseline recorded before edits.

## Gate Results

- Targeted suites: `aquarelleRecordState.move.test.ts` (10), `aquarelleStrokeBridge.test.ts` (11), `aquarelleStrokeSelection.test.ts` (8), `aquarelleRecordState.delete.test.ts` (7) — 36 passed.
- History + clipboard: `useRotoPhysicalEditHistory.test.ts` (58), `physicsPaintRotoScriptClipboard.test.ts` (60) — 118 passed.
- Studio pins: `PhysicsPaintStudio.test.ts` — 204 passed.
- Full app suite (one run): 307 files passed, 2 skipped, 5 failed — only the recorded pre-existing allowlist: `PhysicsPaintRightSidebar.test.ts`, `PhysicsPaintWorkflowStrip.viewport.test.ts`, `efxPaintCompositorMatrix.test.ts`, `exportEngine.test.ts`, `paperPass.frameGuard.test.ts`. 5456 tests passed, 7 failed (all allowlisted), 1 skipped, 96 todo.
- Typecheck: 15 errors after Task 1 and after Task 2, equal to the recorded baseline (15).

## Live UAT — APPROVED (user-run, 2026-10-22)

The user confirmed all three rows end-to-end in the running Studio:

| # | Row | Status |
|---|-----|--------|
| 1 | Cmd+drag a recorded stroke: ghost follows the pointer, the sheet/script stay unchanged during the gesture | PASSED |
| 2 | Release: progress pill advances 0/N -> N/N, then the stroke appears at the released position | PASSED |
| 3 | Undo (Cmd+Z): one press returns the stroke to the origin and re-bakes it; Cmd+Shift+Z re-applies the move | PASSED |

The quick task is UAT-closed; delete, Cmd tap toggle, and the no-script grey-out remain unchanged.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, dependency, or package-format change. The threat-register mitigations (pointer->identity, shared in-flight guard, revision-authoritative snapshots, object-replacing translation, compare-then-write narrow drag signal, refusal messaging) are implemented and pinned.

## Next Phase Readiness

- Automated work is complete and green within the plan's gates.
- The move path reuses the 261022-pim delete ledger/replay port unchanged; delete, Backspace, Cmd tap toggle, and the no-script grey-out retain their pins.
- Awaiting the user's three live UAT rows before closing this quick task.

## Self-Check: PASSED

- Created file exists: `app/src/components/physic-paint/view/aquarelleRecordState.move.test.ts`
- Modified files exist: `aquarelleStrokeSelection.ts`, `aquarelleRecordState.ts`, `aquarelleStrokeBridge.ts`, `AquarelleStrokeOverlay.tsx`
- SUMMARY exists: `.planning/quick/261022-tv1-watercolor-stroke-move/261022-tv1-SUMMARY.md`
- Commits are ancestors of HEAD: `5bc116a9`, `649a924b`
