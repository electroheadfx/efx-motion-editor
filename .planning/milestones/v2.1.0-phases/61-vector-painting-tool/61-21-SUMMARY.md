---
phase: 61-vector-painting-tool
plan: 21
subsystem: ui
tags: [preact, signals, vector-path, rubber-band, capture-phase-keyboard, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-08 the vector pen/path-edit session and its draft signal, 61-02 the spine sampler (sampleVectorPath/uvToScreen), 61-16 the capture-phase window listener and its text-entry yield
provides:
  - "moveVectorDraftCursor(point) — the session's one preview write, compare-then-write, no-op without a draft"
  - "the provisional vector-path-draft-preview polyline drawn from anchors + cursor through the same spine sampler"
  - "isKeyboardOwnedTarget — one duck-typed predicate yielding to every focusable control, text or not"
affects: []

actuals:
  tokens: 7212
  tasks: 2
  commits: 4
  plan_head_before: 0cd7906ec7536a142bc2732b6b15d1415022a85b
  plan_head_after: 3e7b731b9c72beabcce4cc17a3697dff7162963b

tech-stack:
  added: []
  patterns:
    - "Preview-only session writer: read .peek(), return false on an identical station or a null draft, otherwise write a NEW draft carrying the SAME anchors reference (efx-preact-reactivity rule 3)"
    - "Sample the provisional rubber band through the shipped sampleVectorPath module with anchors + an auto cursor anchor — one geometry source, never a hand-drawn chord"
    - "Select onPointerMove per state (edit drag vs draw vs idle) so a move can never enter the edit path or commit"
    - "Name a capture-phase yield for its law, not today's subset: isKeyboardOwnedTarget over ONE duck-typed selector constant"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/vectorPathSession.ts
    - app/src/components/physic-paint/view/vectorPathSession.test.ts
    - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
    - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
    - app/src/components/physic-paint/view/shortcutTextTarget.ts
    - app/src/components/physic-paint/view/shortcutTextTarget.test.ts

key-decisions:
  - "The cursor writer is the session module's one preview write: it returns a boolean and carries draft.anchors by reference, so a future caller can observe a real change and a cursor write can never place an anchor (D-06)"
  - "The rubber band renders BEFORE the committed draft spine, so the placed path stays legible while the next segment previews; the expected points are the spine sampler's own output, not a test-local interpolation"
  - "The pointer-move binding stays state-selected: editInteractive keeps continueEditDrag, drawInteractive gets handleDraftPointerMove, idle binds nothing — a move cannot commit, bake or record"
  - "The yield predicate is renamed, not aliased: isKeyboardOwnedTarget states the widened law, and the five shipped text-entry cases were retargeted with every expectation unchanged"

requirements-completed: [VEC-01]

coverage:
  - id: D1
    description: "While the pen is latched and a draft exists, a pointer move writes the cursor station through the one session writer and carries the anchors unchanged (IN-01, D-06)"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#61-21 IN-01 — the draft cursor writer > writes the cursor station through the one writer and keeps the anchor list"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-21 IN-01 — the live rubber band > never places an anchor or commits from a pointer move, and draws the preview before the spine"
        status: pass
    human_judgment: false
  - id: D2
    description: "In the draw state the overlay renders exactly ONE provisional dashed spine to the cursor, sampled by sampleVectorPath([...anchors, cursor]) and screen-projected, and none without a cursor (UI-SPEC Interaction Contract §2)"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#61-21 IN-01 — the live rubber band > draws one provisional spine to the cursor, and none without a cursor"
        status: pass
    human_judgment: false
  - id: D3
    description: "An identical station notifies zero effects and a move with no draft writes nothing — a stationary pointer cannot churn the overlay signal"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#61-21 IN-01 — the draft cursor writer > notifies nothing for an identical station and writes nothing without a draft"
        status: pass
    human_judgment: false
  - id: D4
    description: "The capture-phase window listener yields to every focusable control that owns its own keystrokes — button, a[href], role=button/menuitem/link/tab — so Enter activates the control and Delete reaches it, while a plain div/canvas target keeps today's commit/delete handling (WR-05)"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/shortcutTextTarget.test.ts#61-21 WR-05 — the focusable-control yield > is true for every focusable non-text control the listener must yield to"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/shortcutTextTarget.test.ts#61-21 WR-05 — the focusable-control yield > covers the six focusable controls and the shipped text-entry four in one selector"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts#VectorPathOverlay — the focusable-control key guard (61-21 WR-05) > stands down on a focused button or role control and still commits/deletes on the canvas"
        status: pass
    human_judgment: false
  - id: D5
    description: "The yield predicate stays dependency-free: no DOM global, no type-identity check, no import — it runs in the node harness and in the capture-phase listener alike"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/shortcutTextTarget.test.ts#61-21 WR-05 — the focusable-control yield > stays dependency-free: no DOM global and no type-identity reference"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathSession.test.ts src/components/physic-paint/view/shortcutTextTarget.test.ts src/components/physic-paint/engine/VectorPathOverlay.test.ts -> 85 passed (18 + 8 + 59)"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit -> exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live judgment: a dashed spine visibly follows the pointer between clicks without changing the committed path, and Enter on a focused sheet button activates it without committing or deleting anything"
    requirement: VEC-01
    verification:
      - kind: manual
        ref: "61-21-PLAN.md <verification> UAT rows A (rubber band follows the pointer, click places at the cursor station) and B (focused header button + Enter activates; no anchor touched)"
        status: pending
    human_judgment: true
    rationale: "The pins prove the sampled preview points, the zero-commit move path and the yield predicate dispatch; only the user can judge the visible dashed band and the live button activation in the Studio."

# Metrics
duration: 6min
completed: 2026-11-11
status: complete
---

# Phase 61 Plan 21: Live Rubber Band and Focusable-Control Key Yield Summary

**The draw state now previews the next segment — one dashed spine sampled from the draft anchors to the cursor, committed by nothing — while the capture-phase listener yields to every focused control, text or not**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-11T10:50:26Z
- **Completed:** 2026-11-11T10:55:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `moveVectorDraftCursor(point)` to the session: it reads `vectorDrawDraft.peek()`, returns false for a null draft or a station already under the cursor, and otherwise writes a new draft carrying the SAME `anchors` reference. It is the module's one preview write and places no anchor (IN-01, D-06).
- Bound `handleDraftPointerMove` as `onPointerMove` only while `drawInteractive`, leaving the edit drag's `continueEditDrag` binding untouched and the idle surface handler-free.
- Rendered ONE `vector-path-draft-preview` polyline sampled by `sampleVectorPath([...draft.anchors, {…cursor, kind: 'auto'}])` and screen-projected with `uvToScreen` — dashed, non-scaling, drawn before the committed draft spine. No cursor marker, no handle, no `renderPath` pass.
- Rewrote `shortcutTextTarget` as `isKeyboardOwnedTarget` over one `KEYBOARD_OWNED_SELECTOR` covering `input, textarea, select, [contenteditable="true"], button, a[href], [role="button"], [role="menuitem"], [role="link"], [role="tab"]`, and updated the two call sites in `VectorPathOverlay.tsx` (WR-05).
- Rewrote the module comment to state the widened law without naming a DOM global, so the leaf module stays node-testable.
- Added the pins: two session, two overlay (IN-01) and three predicate/selector/leaf-law plus one window-key yield pin (WR-05).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: add failing pins for the live rubber band (IN-01)** - `471319888` (test)
2. **Task 1 GREEN: draw the live rubber-band spine to the cursor (IN-01)** - `f0da89386` (feat)
3. **Task 2 RED: pin the focusable-control key yield (WR-05)** - `16380f4d6` (test)
4. **Task 2 GREEN: widen the vector key yield to every focused control (WR-05)** - `3e7b731b9` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathSession.ts` - the one cursor writer (27 lines added)
- `app/src/components/physic-paint/view/vectorPathSession.test.ts` - the `61-21 IN-01` cursor-writer describe (16 → 18 tests)
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` - the draw-only pointer-move handler, the provisional polyline and its sampling helper; the renamed yield import/call (30 lines added, 4 changed)
- `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` - the `61-21 IN-01` rubber-band describe plus the WR-05 window-key yield pin (56 → 59 tests)
- `app/src/components/physic-paint/view/shortcutTextTarget.ts` - the renamed predicate and the ten-token selector (31 lines rewritten)
- `app/src/components/physic-paint/view/shortcutTextTarget.test.ts` - five shipped cases retargeted unchanged plus three widened-law pins (5 → 8 tests)

## Decisions Made

- The cursor writer returns a boolean and is the module's only cursor write; the anchors are carried by reference, so a cursor write can never rebuild or place anchors and a future caller can observe a real change.
- The preview expects the spine sampler's own output (`sampleVectorPath([...anchors, cursor])` mapped by `uvToScreen`), so the pin fails if the implementation ever hand-draws a chord.
- The pointer-move binding stays state-selected rather than universally bound: `editInteractive ? continueEditDrag : drawInteractive ? handleDraftPointerMove : undefined`. A move is a preview, never a gesture (D-06).
- The predicate is a rename for a widened law, not a second export: one constant, one function, two call sites. The five shipped text-entry cases keep their exact expectations under the new name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The working tree carried pre-existing modifications from the previous plan's close (`.planning/STATE.md`, `packages/efx-watercolor/probe/vector-spine/result.json`) and untracked `.red-evidence` directories from earlier plans (61-03 through 61-19). All were deliberately left unstaged; only 61-21 files were committed.
- The RED evidence for Task 2 was validated as `RED_EVIDENCE_OK` / `target_test_failed` before any production code was written.

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence .planning/phases/61-vector-painting-tool/.red-evidence/61-21-t1/red-record.json` → `RED_EVIDENCE_OK`, reason `target_test_failed` (4 failing / 72 passing of 76: the two session pins and the two overlay pins). Target: `61-21 IN-01 — the draft cursor writer > writes the cursor station through the one writer and keeps the anchor list`. GREEN: 76/76 (18 session + 58 overlay).
- Task 2: `gsd_run check tdd-red-evidence .planning/phases/61-vector-painting-tool/.red-evidence/61-21-t2/red-record.json` → `RED_EVIDENCE_OK`, reason `target_test_failed` (4 failing / 63 passing of 67: the three widened-law pins and the window-key yield pin; the five shipped text-entry cases and all 58 shipped overlay cases stayed green). Target: `61-21 WR-05 — the focusable-control yield > is true for every focusable non-text control the listener must yield to`. GREEN: 67/67 (8 + 59), then 85/85 across the three plan suites.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED. Evidence lives under `.planning/phases/61-vector-painting-tool/.red-evidence/61-21-t1/` and `61-21-t2/` (`junit.xml`, `red-record.json`, `run-start.txt`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- IN-01 is closed: the draw state shows the curve the next click will produce, and no pointer move can place, record or commit anything.
- WR-05 is closed: Enter on a focused button/role control reaches the control, Delete reaches a focused role control, and plain canvas targets keep the shipped draw/edit keys.
- Live UAT rows for the user (from the plan's verification): A. latch the vector pen and move the pointer between clicks — a dashed spine follows the cursor; the committed path is unchanged; clicking places the anchor at the cursor station. B. open the stroke sheet, focus a header button, press Enter — the button activates and no anchor is deleted or committed.
- No blockers. Out of this gap-closure scope and untouched: spline curve editing (61-30/61-31), anchor-selection halo/width discoverability (61-22), drag lifecycle (61-28), every paint re-bake concern (61-29).

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-11*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/vectorPathSession.ts
- FOUND: app/src/components/physic-paint/view/vectorPathSession.test.ts
- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.tsx
- FOUND: app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
- FOUND: app/src/components/physic-paint/view/shortcutTextTarget.ts
- FOUND: app/src/components/physic-paint/view/shortcutTextTarget.test.ts
- FOUND: 471319888
- FOUND: f0da89386
- FOUND: 16380f4d6
- FOUND: 3e7b731b9
