---
phase: 61-vector-painting-tool
plan: 10
subsystem: ui
tags:
  - watercolor
  - vector-path
  - path-edit
  - overlay
  - preact-signals
  - tdd
  - undo

# Dependency graph
requires:
  - phase: 61-02
    provides: "The vector spine authority — VectorAnchor, resolveAnchorHandles, clampAnchorWidth and the width constants"
  - phase: 61-03
    provides: "The persisted vector path (anchors + renderMode), normaliseAquarelleAnchors / projectVectorPath and the conditional engine projection"
  - phase: 61-05
    provides: "The recorded-stroke vector seam (updateAquarellePathInScript) and the anchors-aware restore"
  - phase: 61-09
    provides: "VectorPathOverlay's draw gesture, hitTestVectorPath, projectVectorPath and the layer's onStrokeEnd seam"
provides:
  - "vectorPathHandles.ts — promoteAnchorForDrag, moveAnchorBy, moveHandleTo (coupled mirror + Alt break), pointToSegmentDistancePx, insertAnchorOnSegment, deleteAnchorsAt, selectAnchor, buildAnchorWidthCommit"
  - "vectorPathSession.ts — the ONE anchor selection signal with compare-then-write setters, cleared with the edit"
  - "VectorPathOverlay.tsx — anchor drag with permanent auto→bezier promotion, coupled handle drag, spine-click insert, Delete/Backspace removal, additive selection, all through the one onPathEdit seam"
  - "aquarelleRecordState.ts — one mapAnchorList that moves anchors and handles with the points and rebuilds the entry's engine.anchors (T-61-34)"
  - "Studio wiring — handleAquarelleVectorPathEdit with the fixed VECTOR_PATH_REJECTION_MESSAGE and the mount/layer ref chain"
affects:
  - 61-11..61-14 (the dialog plan reads vectorAnchorSelection and the one path-edit seam)
  - Any later path-edit gesture that must stay one undo entry per gesture (VEC-07)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 25959
  tasks: 3
  commits: 6
plan_head_before: 5f02ac6055a26f1c2b3174f231c1c26ac4da330d
plan_head_after: f8977e375848a632003788943f1f66545424eb96

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One gesture = one commit: every completed path-edit gesture passes the FULL anchor list through beginAquarellePathEdit (full stroke replacement at the same payload index, one revision bump), and a no-op stores nothing"
    - "Geometry edits never re-roll the paint seed — beginAquarellePathEdit deliberately omits bumpAquarellePaintSeedSalts"
    - "Screen-pixel overlay chrome: every marker/hit constant is divided or multiplied by physicsPaintCanvasZoom.effectiveScale"
    - "Snapshot law: strokes and their payload entries are REPLACED, never mutated, so a captured `before` side survives an undo"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  modified:
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/view/vectorPathSession.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Alt is read per pointermove, so the coupling break applies mid-drag; every move recomputes from the gesture's start snapshot, so the last event is authoritative."
  - "A spine click is a completed insert gesture at pointerdown: insert, select the new anchor, ONE onPathEdit — no drag state."
  - "mapAnchorList returns undefined for an absent list and maps only the handles an anchor STORED, so a hand-painted stroke gains no anchors key and an auto anchor no invented in/out."
  - "Translate and transform rebuild the entry's engine.anchors from the same mapped list — the payload can never hold a stale path (T-61-34)."
  - "The Studio path-edit handler returns the stored edit id; a null with a READABLE path (in-flight / unchanged) publishes nothing, while a missing or unreadable path publishes the fixed rejection line with status error."
  - "Grabbing an auto anchor promotes it permanently to bezier with the derived handles frozen — a grab-and-release still commits the promoted list (D-03)."

patterns-established:
  - "Anchor selection is one signal written through selectAnchor/set/toggle/clear; no component keeps a second copy"
  - "Every path-edit gesture enters and leaves through beginAquarellePathEdit and the session's compare-then-write setters"
  - "Whole-stroke edits map points and anchors through one map function (mapAnchorList) and always refresh the payload entry"

requirements-completed: [VEC-02, VEC-07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Dragging an anchor moves it and both stored handles by the same delta; release replaces the recorded stroke's anchors and points together and stores exactly one undo entry"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#moveAnchorBy and promotion; app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — anchor drag (task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Grabbing an auto anchor captures its derived handles permanently; dragging one handle mirrors its partner and Alt breaks the coupling for that drag only"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#moveHandleTo — coupling and the break modifier (61-10 task 2); app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — handle drag, insert, delete, width (task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A click on the spine inserts one auto anchor in that segment; Delete/Backspace removes every selected anchor; each is exactly one undo entry and a no-op stores nothing"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#insertAnchorOnSegment — a click on the spine (61-10 task 2); app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#deletes the selected anchors in one commit"
        status: pass
    human_judgment: false
  - id: D4
    description: "A multi-anchor width commit writes every selected anchor in ONE call with sparse width storage and produces exactly one undo entry"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#buildAnchorWidthCommit — one sparse width write (61-10 task 2); app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#commits one width edit for the whole selection"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whole-stroke moves and transforms carry anchors and handles, keep width scale-invariant, add no key to hand-painted strokes, and refuse an unreadable path whole with the fixed rejection line"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts#61-10 aquarelle whole-stroke moves carry the vector path; app/src/components/physic-paint/PhysicsPaintStudio.test.ts#61-10 vector path edit wiring in the Studio"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live UAT: drag an anchor and watch the spine and the paint move together; Alt-drag one handle and see its partner stay; one Cmd+Z restores the whole gesture"
    requirement: VEC-02
    verification: []
    human_judgment: true
    rationale: "Canvas gesture feel and spine/paint alignment on the live surface need human eyes; unit tests prove the recorded data, not the on-screen motion"

# Metrics
duration: 16min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 10: Vector Path Editing Summary

**Direct anchor and handle editing through one undo entry per gesture: drag with permanent auto→bezier promotion, coupled handles with an Alt break, spine-click insert, Delete removal, a one-call multi-anchor width commit, and whole-stroke moves that carry the recorded path**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-10T14:40:00Z
- **Completed:** 2026-11-10T14:55:39Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Anchor drag commits through the single `onPathEdit` seam and stores exactly one undo entry; an `auto` anchor grabbed for a drag is promoted to `bezier` with its derived handles frozen.
- Handles drag with a mirrored coupled partner; holding Alt breaks the coupling for that drag only and leaves the anchor `bezier`.
- A click on a spine segment inserts one evaluated-Bezier auto anchor (selecting it), and Delete/Backspace removes the whole anchor selection in one commit; the spine, width envelope and markers update from the one signal.
- `buildAnchorWidthCommit` writes sparse widths (`1` removes the key, values clamp to [0.2, 2]) for a multi-selection in ONE call, and the overlay commits it as one history entry.
- Whole-stroke translate/transform now map anchors and every stored handle through the same map as the points, keep `width` scale-invariant, leave hand-painted strokes key-identical, and rebuild the payload entry's `engine.anchors` from the same list (T-61-34).
- The Studio refuses a missing or unreadable path whole with the fixed UI-SPEC line on the existing status capsule; a readable path's null edit id (in-flight/no-op) publishes nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end anchor drag (tracer)** - `66747a692` (test), `df3a733f0` (feat)
2. **Task 2: Coupled handles, Alt break, insert, delete, width** - `ed58730d7` (test), `37970ef34` (feat)
3. **Task 3: Whole-stroke moves carry anchors; unreadable-path refusal** - `657dec0d2` (test), `f8977e375` (feat)

**Plan metadata:** see the final docs commit (SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `app/src/components/physic-paint/view/vectorPathHandles.ts` - Promotion, drag, coupled handle move with break, spine distance, insert, delete, selection and width helpers
- `app/src/components/physic-paint/view/vectorPathSession.ts` - The one anchor-selection signal plus compare-then-write actions, cleared with the edit
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - Anchor/handle drag state machine, spine insert, edit-key handler, selection rendering
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - `mapAnchorList` and anchors-aware translate/transform
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` - `onAquarelleVectorPathEdit` prop + ref forwarded to `onEditVectorPath`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `VECTOR_PATH_REJECTION_MESSAGE`, `handleAquarelleVectorPathEdit`, mount memo wiring
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - Optional `onEditVectorPath` seam to the overlay
- Test files: `vectorPathHandles.test.ts`, `VectorPathOverlay.test.ts`, `aquarelleRecordState.path.test.ts` (new), `PhysicsPaintStudio.test.ts`

## Decisions Made
- Alt is read per pointermove so the coupling break works mid-drag; every move recomputes from `anchorsAtStart`.
- A spine click is a completed insert gesture at pointerdown (insert → select → ONE `onPathEdit`), not a drag state.
- `mapAnchorList` returns `undefined` for an absent list and only maps stored handles, so no key is invented.
- Translate/transform set the entry's `engine.anchors` from the same mapped list rather than re-projecting (the stroke's anchors and the payload can never disagree).
- Geometry edits intentionally do not re-roll the paint seed salt (`beginAquarellePathEdit`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a stale 61-09 source pin after the edit-key binding landed**
- **Found during:** Task 2 (GREEN)
- **Issue:** The shipped pin asserted the overlay effect's guard verbatim as `if (!penActive) return`, but the plan-required edit-key binding widened it to `if (!penActive && editMutationId === null) return`.
- **Fix:** Renamed the pin to describe the binding and asserted the new guard (in-scope: the guard changed because of this task's own wiring).
- **Files modified:** `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts`
- **Verification:** 85/85 in the Task 2 file set.
- **Committed in:** `37970ef34` (Task 2 GREEN)

**2. [Rule 1 - Bug] Updated two shipped dependency-list pins for the new mount dep**
- **Found during:** Task 3 (GREEN verification)
- **Issue:** Two shipped pins asserted the full `canvasMountPropsMemo.resolve` dependency substring ending in `handleAquarelleTransformStrokes]`; the plan requires passing `handleAquarelleVectorPathEdit` in the same list.
- **Fix:** Appended `handleAquarelleVectorPathEdit` to both pinned substrings.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** `355/355` in the Task 3 file set; full suite green.
- **Committed in:** `f8977e375` (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** Both were pins the plan's own wiring invalidated; no behaviour or scope change.

## Issues Encountered
- RED evidence for Task 3 initially missed the mixed-batch stale-copy case (it passed on the shipped mutator), so the test was strengthened and RED re-run before committing the tests — the committed evidence matches the committed test set.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VEC-02 and VEC-07 are implemented and pinned: every gesture is one `beginAquarellePathEdit` and a no-op stores nothing.
- `vectorAnchorSelection` and the one path-edit seam are ready for the 61-11 dialog plan.
- End-of-phase live UAT remains: drag an anchor, Alt-drag a handle, and one Cmd+Z restoring the gesture (see D6).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All key files exist on disk.
- All six plan commits (`66747a692`, `df3a733f0`, `ed58730d7`, `37970ef34`, `657dec0d2`, `f8977e375`) are ancestors of HEAD.
