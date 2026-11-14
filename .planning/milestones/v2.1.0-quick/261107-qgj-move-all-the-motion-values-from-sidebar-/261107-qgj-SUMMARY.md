---
phase: 261107-qgj-move-all-the-motion-values-from-sidebar-
plan: 01
subsystem: ui
tags: [preact, signals, motion-channels, floating-sheet, tdd, modal, numeric-stepper]

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    provides: rail motion model/commands (writeRailMotionChannelValueAtCursor, setMotionKeyAtCursor), readActiveRailMotionState, railMotionSelectedChannel/railMotionSelectedKey, projectRailMotionInspector, the four-sheet-capable floating stack
provides:
  - 'projectRailMotionInspectorAtFrame: animate-mode projection at any rail-local frame plus the RailMotionDialogBundle contract'
  - 'railMotionDialog computed (open condition, property-over-key precedence, frame law) and commitRailMotionInspectorValue (frame-bound write)'
  - 'clearRailMotionSelection — the ONE modal close path (clears property AND Motion-key selection)'
  - 'PhysicsPaintRailMotionModal: props-driven fourth floating sheet with present-only fields, one verbatim rejection alert, drag/resize/session layout'
  - 'SHEET_ID_RAIL_MOTION (rail-motion) at the fourth stack seat (z 50/51/52/53, 12/28/44/60 cascade)'
  - 'the 59-16 Motion inspector and every dead prop/state/copy/import removed from all three Scripts-panel branches'
affects: [rail motion channels surface, Scripts panel, floating sheet stack, NumericStepper exception allow-list]

# Actuals (#2632) — same chars/4 scale as the plan's estimate.
actuals:
  tokens: 31824
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - 'Props-driven floating sheet: the Studio passes a signal REFERENCE; the modal is its only reader (narrow subscription, frame ticks never re-render the Studio view)'
    - 'Bundle binds the displayed frame; commit re-reads live records but writes at presentation.frame (never re-derives from a moved playhead)'
    - 'ONE close path shared by header X and front-only Escape clears both selections and needs no tool restore'
    - 'Session sheet layout in module-scope signals, compare-then-write in pointer handlers only, resetRailMotionModalLayout for tests'
    - 'Rejection shown verbatim in a single role="alert"; the modal authors no sentence'

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts
  modified:
    - app/src/components/physic-paint/view/floatingSheetStack.ts
    - app/src/components/physic-paint/view/floatingSheetStack.test.ts
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts
    - app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
    - app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts
    - app/src/components/shared/NumericStepper.test.tsx

key-decisions:
  - "Open condition is railMotionSelectedChannel !== null OR railMotionSelectedKey !== null on the active track's resolved rail; property mode wins when both are set."
  - "Property mode reads/writes at state.localCursorFrame (the canvas gizmo's frame); key mode keeps the 59-16 law at the selected key's frame; absent channels never render."
  - "The bundle captures presentation.frame and its commit refuses a stale rail or an unselected state before writing through applyWriteRailMotionChannelValue -> commitRailMotionRecords (one store commit, one undo step)."
  - "clearRailMotionSelection = selectRailMotionKey(null) + exitRailMotionEditing(); no paint-tool restore is needed because animate mode never changed the tool."
  - "The modal imports no store and uses signal() inside useRef for rejection state (no useSignal in this harness, no useState anywhere)."
  - "The fourth seat is 60px so the Settings header strip (44px seat) stays clickable; z comes only from sheetZIndex(SHEET_ID_RAIL_MOTION)."

patterns-established:
  - 'Animate-mode numeric editing: property/key selection -> projection bundle -> present-only steppers -> frame-bound commit -> verbatim rejection.'
  - 'Sheet relocation: a view surface moves from a sidebar branch to a props-driven modal; its store coupling is deleted, its NumericStepper exception allowance follows it.'

requirements-completed: [QUICK-261107-QGJ]

coverage:
  - id: D1
    description: "At-frame projection and the dialog bundle contract: fixed D-13 order, present from channel existence, stored at a keyed frame vs evaluator at an unkeyed frame, frozen output, frame normalization"
    requirement: QUICK-261107-QGJ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts#projectRailMotionInspectorAtFrame (261107-qgj: property-mode projection)"
        status: pass
    human_judgment: false
  - id: D2
    description: "railMotionDialog open/precedence/frame law, frame-bound write through the store, stale-rail and unselected refusals, and the ONE close path clearing both selections"
    requirement: QUICK-261107-QGJ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#261107-qgj floating Motion modal projection and write"
        status: pass
    human_judgment: false
  - id: D3
    description: "The floating Motion modal: closed->null, Motion dialog header/close ids, present-only fields with units/values, per-field commit, one verbatim role=alert, close guard, z from the shared four-sheet stack"
    requirement: QUICK-261107-QGJ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts#261107-qgj floating Motion modal"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 59-16 sidebar inspector and every dead motion prop/state/copy/import removed from all three Scripts-panel branches; no NumericStepper import remains"
    requirement: QUICK-261107-QGJ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#Physics Paint Scripts panel carries no Motion inspector (261107-qgj)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sheet mechanics: header drag with 80px horizontal and header-reachable clamps, bottom resize with 240px floor and viewport max, session persistence across close/reopen, reset"
    requirement: QUICK-261107-QGJ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts#the header drag moves the surface; clamps the drag; the bottom resize; the layout is session-scoped"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live visible UAT: modal opens on property/key selection, edits land at the displayed frame, close returns to the paint tool, Escape is front-only, rejection copy, picker step-aside, Scripts tab empty"
    requirement: QUICK-261107-QGJ
    verification: []
    human_judgment: true
    rationale: "Live open/close feel, canvas pose update, tool restoration and sheet fronting are visible behaviours the node harness cannot observe; the user runs the eight UAT rows."

# Metrics
duration: ~35min (session resumed across context compaction; task commits 2026-11-07T19:22:10+01:00 .. 19:33:17+01:00)
completed: 2026-11-07
plan_head_before: 9a8820176c4d716c0d6ebcf2987ebc8cb79cd094
plan_head_after: 615f38acdf5b71f72232652588222f807608802a
status: complete
---

# Quick 261107-qgj: Motion Values Moved to a Floating Modal Summary

**Every Motion numeric value now lives in a props-driven floating Motion modal opened by the animate-mode property selection or a Motion-key selection, and the retired 59-16 sidebar inspector is gone from all three Scripts-panel branches.**

## Performance

- **Duration:** ~35 min (session resumed across context compaction; the task commits landed 19:22:10 → 19:33:17 +01:00)
- **Started:** not captured precisely (context compaction); the ledger recorded HEAD `9a8820176` before the first commit
- **Completed:** 2026-11-07
- **Tasks:** 3
- **Files modified:** 16 (2 created, 14 modified, including 2 deviation test pins)

## Accomplishments

- `projectRailMotionInspectorAtFrame` + the shared `projectRailMotionFields` helper: one conversion authority for both projections, fixed D-13 order, present from channel existence only, stored values at a keyed frame and evaluator values at an unkeyed frame, frozen output at every level, frames normalized (`-3`, `NaN`, `+Inf` → 0; `4.9` → 4).
- `RailMotionDialogBundle` contract: the presentation plus a commit bound to the frame the fields displayed, returning the visible rejection or null.
- `railMotionDialog` computed: null when neither a property nor a Motion key is selected; property mode wins and projects at `state.localCursorFrame`; key mode requires the selection's rail to equal the live record and projects at the key frame. `commitRailMotionInspectorValue` re-reads live state, refuses a stale rail ("Select a rail with Motion first.") or an unselected state ("Select a Motion key first."), then writes through `applyWriteRailMotionChannelValue` + `commitRailMotionRecords` — one store commit, one undo step, grouped Position pair atomic.
- `clearRailMotionSelection` is the ONE close path: `selectRailMotionKey(null)` + `exitRailMotionEditing()`. Header X and front-only Escape share it; the paint tool needs no restore because animate mode never changed it.
- New `PhysicsPaintRailMotionModal.tsx`: props-driven (no store import, no `useState`, rejection state via `signal()` in `useRef`), role="dialog" aria-label "Motion", present-only `NumericStepper` rows showing `Label (unit)` with `freeEntry`, `step={1}`, `precision={3}`, one verbatim `role="alert"` rejection that remounts the rejected field at the projected value, header `Move` icon, close button with a pointerdown drag guard.
- Fourth floating sheet: `SHEET_ID_RAIL_MOTION` appended to the order (z 50/51/52/53), raises on open and on capture-phase pointerdown, releases its id when closed, serves its own front-only Escape with the shared editable-input guard, and mounts in the Studio view beside Settings while stepping aside for any gallery picker.
- Session sheet mechanics: header drag (80px horizontal visibility, header kept on screen, release stops the drag) and bottom resize (240px floor, viewport-derived max, 34x3 grip), both persisted in module-scope compared-then-written signals with `resetRailMotionModalLayout()`.
- The Scripts panel lost the entire 59-16 inspector: motion props, transient signal + clearing effect, copy constants, `commitMotionValue`/`motionValuesSection`, all three branch injections, and the `signal`/`NumericStepper`/channel-id/presentation imports. The Studio lost the `projectRailMotionInspector` import, the `selectedMotionKeySelection`/`railMotionInspector` memo (and its dep) and the two scripts-bundle entries.
- Four-sheet z re-baselining across the stack and brush-picker suites (initial brushes stay 51; raises reach 53; Settings opened from the initial order is 53).

## Task Commits

Each task was committed atomically (Task 1 spans the RED and GREEN commits of its TDD cycle):

1. **Task 1 RED: failing projection/write tests** — `e25566732` (test) — 1 file, 282 insertions
2. **Task 1 GREEN: floating modal, projection, computed, close path, stack** — `4b5e878bb` (feat) — 11 files, 921 insertions, 67 deletions
3. **Task 2: remove the retired Motion inspector from the Scripts panel** — `0ef3256aa` (refactor) — 3 files, 13 insertions, 405 deletions
4. **Task 3: sheet mechanics, close-path pins, full regression** — `615f38acd` (feat) — 4 files, 317 insertions, 6 deletions

Measured: `git rev-list --count 9a8820176c4d716c0d6ebcf2987ebc8cb79cd094..HEAD` = **4**. Docs artifacts (SUMMARY/STATE/PLAN) are intentionally not committed here — the orchestrator owns the docs commit.

## Files Created/Modified

- `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.tsx` — new props-driven fourth sheet: present-only fields, rejection alert, Escape/close, drag/resize/session layout
- `app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts` — new, 16 tests (render, commit, rejection, close, stack, drag, resize, session, source pins)
- `app/src/components/physic-paint/view/floatingSheetStack.ts` — `'rail-motion'` id, four-sheet order, docs
- `app/src/components/physic-paint/view/floatingSheetStack.test.ts` — four-id order/z, front-only handler list includes the modal
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — shared `projectRailMotionFields`, `projectRailMotionInspectorAtFrame`, `RailMotionDialogBundle`
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts` — 5 at-frame projection tests (suite now 27)
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `railMotionDialog`, `commitRailMotionInspectorValue`, `commitRailMotionInspectorValueAtFrame`, `clearRailMotionSelection`
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — new describe for open/precedence/frame/write/close (suite now 191)
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — optional `railMotionDialog` / `onCloseRailMotionDialog` props and the picker-gated mount
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — fixture field and 0/1 modal counts, picker step-aside test
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — view-model wiring; dead projection/memo/scripts entries removed
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — motion inspector, state and imports removed from all three branches
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` — 59-16 describe replaced by a deletion pin
- `app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts` — four-sheet z re-baseline
- `app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts` — import pin follows the combined `railMotionEditingMode` import (deviation)
- `app/src/components/shared/NumericStepper.test.tsx` — exception allow-list retargeted from the Scripts panel to the motion modal (deviation)

## Decisions Made

- Open condition and precedence: the property selection (`railMotionSelectedChannel !== null`) wins over the key selection; both unset means no modal.
- Frame law: the bundle binds `presentation.frame` at creation; the commit re-reads live records but writes at that displayed frame, so a playhead moved after open can never redirect a typed value (T-261107-QGJ-02).
- The commit refuses a stale rail and an unselected state before reaching the command layer, and the modal never authors a rejection sentence.
- Close is one action with two callers; clearing the channel restores the paint tool implicitly because animate mode never wrote the tool.
- The modal subscribes narrowly to the dialog signal so frame ticks re-render the small modal, never the Studio view.
- Sheet layout survives close/reopen for the Studio session, matching the sibling sheets, and is reset only by `resetRailMotionModalLayout()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retargeted the NumericStepper exception allow-list to the moved inspector**
- **Found during:** Task 3 full-suite run
- **Issue:** `numericStepperSweep` allow-lists the Motion inspector's `freeEntry` call site by path; it still named `PhysicsPaintScriptsPanel.tsx`, which no longer renders a stepper, so `PhysicsPaintRailMotionModal.tsx` was flagged as an offender and the full suite failed.
- **Fix:** `MOTION_INSPECTOR_CALL_SITE_REL` now names `PhysicsPaintRailMotionModal.tsx` (comment records the move). The allowance stays a fixed list — no blanket rule.
- **Files modified:** `app/src/components/shared/NumericStepper.test.tsx`
- **Verification:** `vitest run NumericStepper.test.tsx.test.ts` — 41 passed.
- **Committed in:** `615f38acd` (Task 3 commit)

**2. [Rule 1 - Bug] Updated a source pin broken by the Task 1 import change**
- **Found during:** Task 3 full-suite run
- **Issue:** `railMotionBoundaryTool.test.ts` pinned the exact line `import { railMotionSelectedChannel } from '../view/railMotionEditingMode';`. Task 1 legitimately added `exitRailMotionEditing` to that import, so the pin failed although the gizmo still gates on the single animate-mode signal.
- **Fix:** The pin now expects the combined import, with a comment naming the quick task. The law it protects (one selected, present, draggable channel) is unchanged.
- **Files modified:** `app/src/components/physic-paint/view/railMotionBoundaryTool.test.ts`
- **Verification:** `vitest run railMotionBoundaryTool.test.ts` — 5 passed.
- **Committed in:** `615f38acd` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1)
**Impact on plan:** Both are source-scan pins directly broken by the plan's own relocation and rename; no behaviour changed, no production file went outside the plan's list.

## Issues Encountered

- The first RED-evidence record was rejected as `INVALID_RED (invalid_record)` because the captured output carried trailing non-TAP lines (an `undefined` and pnpm's failure footer) after the closing TAP document. Rebuilding the record with `output` limited to the TAP lines 1..316 plus a semantic assessment produced `RED_EVIDENCE_OK` (191 tests, 5 honest failures).
- Test-suite authoring needed no config changes; the new modal suite is `.test.ts` because the project collects only `src/**/*.test.ts`.
- No typecheck, dependency-install or auth failures. No live server was started and Vitest ran with `run` only.

## Verification

- Targeted suites: projection (27), actions (191), modal (16), Scripts panel (62), studio view (5), stack + brush picker, boundary tool (5), NumericStepper sweep (41) — all green.
- Full suite: **399 test files passed | 2 skipped; 8007 tests passed | 1 skipped | 96 todo; 0 failed**.
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
- Tracer gate (Task 1, `human_verify_mode: end-of-phase`, automated-only verify): re-ran end-to-end and continued without a checkpoint; auto mode was not active.
- Scope tripwire: `git diff --name-only 346890e51 -- app/src` lists exactly this plan's 14 files plus the two deviation test pins above; no stores, `src-tauri`, evaluator or CSS path.

## Known Stubs

None. No placeholder copy, no empty-state component and no unwired data source was introduced; the modal renders only channels the rail actually carries.

## Threat Flags

None — every surface introduced here is enumerated in the plan's register T-261107-QGJ-01..05 plus SC (stale projection, moved-playhead write, silent rejection, inert sibling Escape, sheet overlap, dependency installs); no new trust boundary appeared.

## User Setup Required

None — no external service configuration or dependency install.

## UAT Rows Handed to the User

Live visible UAT (automated-green is not done):

1. Select a Motion property in the pinned header: the Motion modal appears, listing only the channels this rail actually carries (no 'not added' ghosts, no absent note).
2. Type a value in the modal: the canvas pose updates, a key appears at the playhead on that channel's lane, and the value survives close/reopen.
3. Close with the header X: the property deselects, the canvas goes back to the brush, and the paint tool that was active before is still selected. Repeat with Escape.
4. Select a Motion key with no property selected: the modal opens on that key's frame; editing writes that key's frame, and closing clears the key highlight without moving the playhead.
5. Open Settings, then the Motion modal: the Motion modal is in front. Press Escape: only the Motion modal closes and Settings stays open.
6. Type an out-of-domain Scale (0): the command's rejection sentence appears in the modal and no key is written.
7. While any gallery picker is open, the Motion modal steps aside and returns when the picker closes.
8. The Scripts tab shows no motion fields in the normal list, the Key Rail inspector or the Loop Clip inspector.

## Next Phase Readiness

- The Phase 59 motion surface now edits values in a floating sheet without the sidebar, on branch `gsd/phase-59-rail-motion-channels-v7-interface`; no persisted shape changed and no new gesture system was added.
- Blocked only on the eight live UAT rows above.

---
*Quick: 261107-qgj-move-all-the-motion-values-from-sidebar-*
*Completed: 2026-11-07*

## Self-Check: PASSED

- Created files verified on disk: `PhysicsPaintRailMotionModal.tsx`, `PhysicsPaintRailMotionModal.test.ts`, this SUMMARY.
- All 4 task commits are ancestors of HEAD: `e25566732`, `4b5e878bb`, `0ef3256aa`, `615f38acd`.
