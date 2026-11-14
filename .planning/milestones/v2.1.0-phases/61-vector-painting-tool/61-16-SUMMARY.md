---
phase: 61-vector-painting-tool
plan: 16
subsystem: ui
tags: [preact, signals, pointer-capture, keyboard-guard, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-10 path-edit seam and selection, 61-13 wireframe chrome, 61-15 the single leaf commit route and the edit-snapshot latch
provides:
  - Pointer capture owned by a path-edit drag for its whole lifetime, released on finish and on cancel
  - A dependency-free isTextEntryTarget predicate and a guarded window-key dispatcher
  - Truthful edit-snapshot assertion titles (the ledger claim stays with 61-15)
affects: [61-17, 61-18, 61-20]

actuals:
  tokens: 7500
  tasks: 2
  commits: 5
  plan_head_before: b63a3ce6b96a36617809b1d32ffa2ad85729191d
  plan_head_after: 2a579b2ceceaf081b8b8ebe38009c0059dbe4d47

tech-stack:
  added: []
  patterns:
    - "Duck-typed optional-capability interface for pointer capture, so the whole gesture is unit-testable without a DOM"
    - "A capture-phase window listener routes through a target-guard dispatcher; the pure key handlers stay target-agnostic and keep their own tests"

key-files:
  created:
    - app/src/components/physic-paint/view/shortcutTextTarget.ts
    - app/src/components/physic-paint/view/shortcutTextTarget.test.ts
  modified:
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts

key-decisions:
  - "The release runs AFTER the commit decision in finishEditDrag, not in a finally: a capture release must never be able to swallow an edit"
  - "Both drag kinds carry the captured pointerId in their own state, so finish and cancel release the exact pointer the press took"
  - "The predicate is a new leaf rather than a refactor of the Studio's isPhysicsPaintShortcutTarget: that one needs a real DOM and a closest() walk, and G-4 is about the overlay's listener"
  - "The spine insert click takes no capture by construction — it opens no drag state, so there is no later move or release to route"
  - "The two false 'history entry' titles are renamed, not deleted: the assertions keep proving the single snapshot and the single restore"

requirements-completed: [VEC-01, VEC-02, VEC-07]

coverage:
  - id: D1
    description: "A path-edit drag captures the pointer at press (anchor and handle), so a move or release outside the overlay still updates and commits the edit"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > captures the pointer at an anchor press, and the drag still commits on up"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > captures the pointer at a handle press and commits the handle drag on up"
        status: pass
    human_judgment: true
    rationale: "The unit pins prove the capture call and the commit; only a real pointer stream dragged off the overlay proves the browser re-targets the move and the up to the overlay."
  - id: D2
    description: "The capture is released on both exits, after the commit on finish, and only when the target still holds the pointer"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > releases the capture AFTER the commit decision, on the drag pointer id"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > releases the capture on cancel and commits nothing"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > releases only a pointer the target still holds, and never throws"
        status: pass
    human_judgment: false
  - id: D3
    description: "The insert-on-spine click opens no drag state and therefore takes no capture"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the pointer-capture law (61-16) > takes no capture for the insert-on-spine click and still commits once"
        status: pass
    human_judgment: false
  - id: D4
    description: "Vector Enter/Escape/Delete/Backspace are inert while a text-entry target has focus, and still act on the canvas or the overlay"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/shortcutTextTarget.test.ts#shortcutTextTarget — the text-entry predicate (61-16)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the text-entry key guard (61-16) > stands down on Enter while a dialog text field has focus"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the text-entry key guard (61-16) > still commits the draft when focus sits outside a text field"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the text-entry key guard (61-16) > stands down on Backspace in a textarea and still deletes on the canvas"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two assertions that called the edit-map snapshot a history entry now name the edit snapshot, and the ledger claim is carried by 61-15's stack-length test"
    requirement: VEC-07
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#stores exactly ONE edit snapshot for one changed anchor, restores it in one undo, and refuses while in flight"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#writes a three-anchor width commit as ONE edit snapshot that one undo restores"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 16: Pointer Capture and the Text-Entry Key Guard Summary

**A path-edit drag now owns the pointer for its whole lifetime, and the overlay's capture-phase vector keys yield to a focused dialog field — with the two false "history entry" titles corrected**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-10T21:36:16Z
- **Completed:** 2026-11-10T21:43:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `startEditDrag` now captures the pointer at press on BOTH drag kinds (anchor and handle), so a move or a release that leaves the overlay still reaches the gesture instead of stranding it (G-3 / CR-01).
- `finishEditDrag` releases the capture AFTER the commit decision; `cancelEditDrag` releases it and clears the state. A release is attempted only when the target does not report the pointer is already gone, and a missing or throwing capture method is swallowed.
- The insert-on-spine click stays capture-free by construction: it opens no drag state, so there is no later move or release to route.
- New `shortcutTextTarget.ts` leaf: a dependency-free, DOM-global-free `isTextEntryTarget` covering INPUT / TEXTAREA / SELECT, contenteditable, their descendants, and a throwing `closest()`.
- `handleVectorPathWindowKey` yields to any text-entry target before either pure key handler runs, so a dialog's Enter/Delete are neither consumed nor `preventDefault`ed (G-4 / CR-02). The two pure handlers are untouched and keep their own tests.
- The two assertions that called the edit-map snapshot a history entry now name the edit snapshot and its single restore; the ledger claim stays with 61-15's stack-length test (G-8 test truth).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the pointer-capture law for path-edit drags** - `410fd29be` (test)
2. **Task 1 GREEN: let a path-edit drag own the pointer until it ends** - `1f0e52632` (feat)
3. **Task 2 RED: pin the text-entry key guard and the true edit-snapshot titles** - `ab283d1ca` (test)
4. **Task 2 RED follow-up: activate the pen for the dispatcher draft fixtures** - `aa91efca4` (test)
5. **Task 2 GREEN: stand the vector keys down while a text field has focus** - `2a579b2ce` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - `capturePointer` / exported `releasePointerCapture`, `pointerId` on both drag states, the two capture sites, the two release sites, `handleVectorPathWindowKey`, and the guarded listener
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - the six pointer-capture cases, the three dispatcher cases, the two renamed edit-snapshot titles, and the corrected listener source pin
- `app/src/components/physic-paint/view/shortcutTextTarget.ts` - the dependency-free `isTextEntryTarget` leaf
- `app/src/components/physic-paint/view/shortcutTextTarget.test.ts` - five predicate cases, including a hostile `closest()` and a source-law pin

## Decisions Made

- The release runs after the commit decision, never in a `finally`: a capture release must not be able to swallow an edit.
- Each drag state carries the `pointerId` it captured, so finish and cancel release the exact pointer the press took rather than the pointer of the ending event.
- The predicate is a new leaf, not a refactor of the Studio's `isPhysicsPaintShortcutTarget`: that one needs a real DOM and a `closest()` walk against real nodes, and the overlay is a leaf module that must stay callable from a node-environment test.
- The release tolerates a target that does not report `hasPointerCapture`: it releases when the answer is `true` or absent, and skips only an explicit `false`.
- The two false titles are renamed, not deleted — the assertions keep proving one snapshot per gesture and one undo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-captured the Task 2 RED after a fixture bug**
- **Found during:** Task 2 GREEN (first run)
- **Issue:** The two dispatcher draft cases pressed on a null render: `resetForStudioOpen()` leaves the pen released, so the overlay returns `null` and the failure was `Cannot read properties of null`, not the missing dispatcher. A RED that fails for an unrelated reason is not evidence for the behaviour it claims to pin.
- **Fix:** The describe `beforeEach` now sets `vectorPenActive.value = true`; the RED run was repeated against the reverted implementation and re-captured. All three dispatcher cases now fail on `handleVectorPathWindowKey is not a function`, and the evidence record was rewritten to say exactly that, including the earlier fixture fault.
- **Files modified:** `VectorPathOverlay.test.ts`, `.red-evidence/61-16-t2/{junit.xml,red-record.json}`
- **Verification:** `RED_EVIDENCE_OK` (`target_test_failed`) on the refreshed record; 7 failing / 53 passing of 60.
- **Committed in:** `aa91efca4`

**2. [Rule 1 - Bug] Corrected the shipped listener source pin**
- **Found during:** Task 2 GREEN
- **Issue:** The shipped pin `expect(source).toContain('handleVectorPathEditKey(event')` would still have passed after the listener was re-pointed — the dispatcher's own body contains that substring. A pin that passes for the wrong reason is the same class of false assurance G-8 is about.
- **Fix:** The pin now asserts the guarded dispatcher call (`handleVectorPathWindowKey(event, handlersRef.current, editKeyHandlersRef.current)`) and the capture-phase `addEventListener` line, keeping the dependency-array and `removeEventListener` assertions.
- **Files modified:** `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts`
- **Verification:** The rewritten pin passes; the full app suite is green.
- **Committed in:** `2a579b2ce`

---

**Total deviations:** 2 auto-fixed (1 invalid RED fixture, 1 coincidental source pin)
**Impact on plan:** Both were required for the evidence and the assertions to mean what they claim. No scope creep: no Studio file was touched.

## Issues Encountered

- `gsd_run check tdd-red-evidence` rejects a record that carries only a `reportPath` ("Unsupported report format"); it parses the inline `output` field. The Task 2 record was rebuilt with the JUnit XML inline, matching the Task 1 shape.
- The RED commit for the new leaf includes an export-free stub (`export {}`) so the import resolves: without it the failure would be a module-resolution error rather than the missing behaviour. The GREEN commit replaces the stub body.
- The first Task 2 GREEN run failed the new leaf's own source pin because the doc comment contained the literal token the pin forbids; the comment was reworded, not the pin.

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (4 failing / 48 passing of 52 at RED).
- Task 2: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (7 failing / 53 passing of 60 at the reverted HEAD).
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-3/G-4/G-8 are implemented and pinned. The live UAT row is the drag: start an anchor drag inside the overlay, drag the pointer off the overlay, release outside, and confirm the path is edited and committed in one gesture (D1 is the human-judgment row).
- The key guard is deterministic and unit-pinned; a live check that the Stroke Settings dialog's Enter submits while a path edit is open is worth doing alongside the drag row.
- 61-17/61-18 can build on the pointer-owning drag; 61-20's ledger entry is unaffected — this plan records none.
- No blockers: both new seams fail closed (a lost pointer is not released; a text-entry target is never prevented).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.tsx
- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- FOUND: app/src/components/physic-paint/view/shortcutTextTarget.ts
- FOUND: app/src/components/physic-paint/view/shortcutTextTarget.test.ts
- FOUND: 410fd29be
- FOUND: 1f0e52632
- FOUND: ab283d1ca
- FOUND: aa91efca4
- FOUND: 2a579b2ce
