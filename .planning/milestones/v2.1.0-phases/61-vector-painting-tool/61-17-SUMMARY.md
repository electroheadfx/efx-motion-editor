---
phase: 61-vector-painting-tool
plan: 17
subsystem: ui
tags: [preact, signals, vector-path, choke-point, wireframe, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 61-vector-painting-tool
    provides: 61-08 session latches, 61-10 the path edit and its anchor selection, 61-13 the wireframe latch, 61-15/61-16 the adjacent vector seams
provides:
  - The dependency-free vectorPathLatches leaf (pen, path edit, anchor selection and their exit actions), re-exported by the session with signal identity preserved
  - Select entry releases the pen and closes the path edit; entry is refused while wireframe is on
  - Picker latch entry releases the pen and closes the path edit; disarm touches neither
  - The T-61-60 static import pin on the picker's one-way edge
affects: [61-18, 61-19, 61-20]

actuals:
  tokens: 6690
  tasks: 2
  commits: 4
  plan_head_before: 0caac160d382b17cc65c878c9e5ea14bace1999c
  plan_head_after: 8acd9cfad20cd37756436e63840be79f88ee47c3

tech-stack:
  added: []
  patterns:
    - "Lift shared latches into a dependency-free leaf and re-export them from the owner module: both entry choke points import the leaf, so no evaluation cycle is possible and signal identity is preserved"
    - "Release sibling surfaces only on a surface's false -> true entry edge, never on its exit edge"

key-files:
  created:
    - app/src/components/physic-paint/view/vectorPathLatches.ts
    - app/src/components/physic-paint/view/vectorPathLatches.test.ts
  modified:
    - app/src/components/physic-paint/view/vectorPathSession.ts
    - app/src/components/physic-paint/view/vectorPathSession.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/view/aquarelleColorPicker.ts
    - app/src/components/physic-paint/view/aquarelleColorPicker.test.ts

key-decisions:
  - "The session keeps `export * from './vectorPathLatches'` plus an explicit import list; identity is pinned by a test, so every shipped import path keeps working unchanged"
  - "The session's preact import drops `type Signal` after writeIfChanged moves to the leaf (noUnusedLocals); the replaced pin asserts the truthful four-line import list"
  - "The wireframe refusal is the FIRST statement of setAquarelleSelectMode, before any write, so the refused entry notifies nobody and touches no surface"
  - "The release calls sit inside the existing `if (on)` block beside the picker and rail-motion disarms; the exit edge never calls either action"
  - "The T-61-60 pin asserts the picker's exact import lines (preact + latch leaf), a stronger fact than a forbidden-substring list"

requirements-completed: [VEC-01, VEC-02]

coverage:
  - id: D1
    description: "Entering Select releases the vector pen and closes any open path edit, so the Select overlay receives the click instead of being covered by the pen overlay (G-6)"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-17 G-6 Select entry releases the vector pen > releases the vector pen on Select entry and keeps Select on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-17 G-6 Select entry releases the vector pen > closes an open path edit and clears its anchor selection on Select entry"
        status: pass
    human_judgment: true
    rationale: "The pins prove the calls and the resulting latch values; only a live Select click proves the overlay actually receives it and the draft stops accumulating anchors."
  - id: D2
    description: "Entering the color picker releases the vector pen and closes any open path edit, so a latched pick is not swallowed by the pen overlay (G-6)"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-17 G-6 the picker latch releases the vector pen > latching the picker releases the vector pen and arms the picker"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#61-17 G-6 the picker latch releases the vector pen > latching the picker closes an open path edit and clears its anchor selection"
        status: pass
    human_judgment: true
    rationale: "The pins prove the latch pair; only a live latched pick proves the sample lands on the sheet instead of the pen overlay eating the click."
  - id: D3
    description: "The exclusion is enforced at the two entry choke points, so every route into Select or the picker inherits it without a per-caller fix"
    requirement: VEC-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#261022-pim aquarelle stroke select mode > setAquarelleSelectMode is compare-then-write"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts (15 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts (28 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pen latch is a dependency-free leaf imported by both entry modules, with one copy of each signal and no import cycle"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathLatches.test.ts#vectorPathLatches — one copy of each latch (61-17) > the session module re-exports the SAME signal objects, not copies"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathSession.test.ts#the session module is session-only (T-61-53) > imports only the signals runtime and the three sibling session surfaces"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleColorPicker.test.ts#the picker module keeps its one-way edge (T-61-60) > imports only the signals runtime and the dependency-free latch leaf"
        status: pass
    human_judgment: false
  - id: D5
    description: "The pen still latches correctly: the Select exit edge never releases it, and the exits are compare-then-write"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-17 G-6 Select entry releases the vector pen > never releases the pen on the Select exit edge"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathLatches.test.ts#vectorPathLatches — one copy of each latch (61-17) > exitVectorPen and exitPathEdit are compare-then-write: 1000 calls notify once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathLatches.test.ts#vectorPathLatches — one copy of each latch (61-17) > exitPathEdit drops the anchor selection with the edit"
        status: pass
    human_judgment: false
  - id: D6
    description: "Select entry is refused while wireframe is on, and leaving Select is never refused (D-16)"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-17 G-6 Select entry releases the vector pen > refuses Select entry while the wireframe view is on"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#61-17 G-6 Select entry releases the vector pen > still turns Select off while the wireframe view is on"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 17: Select and Picker Entry Release the Vector Pen Summary

**Entering Select or the color picker now releases the vector pen and closes any open path edit at each surface's one choke point, and Select cannot be entered while the wireframe view is on**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-10T21:45:59Z
- **Completed:** 2026-11-10T21:50:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added the dependency-free leaf `vectorPathLatches.ts` (imports only the signals runtime): `vectorPenActive`, `pathEditMutationId`, `vectorAnchorSelection`, the three anchor-selection writers, `writeIfChanged`, `exitVectorPen` and `exitPathEdit`, moved with no behaviour or identity change.
- `vectorPathSession.ts` now re-exports the leaf (`export *`) and imports the symbols its own functions call; the draft types, `vectorDrawDraft`, the entry arbitration and `resetForStudioOpen` stay in place, so every shipped import path — Studio, rail, dialog, layer, overlay — compiles unchanged.
- `setAquarelleSelectMode` refuses entry outright while `wireframeMode` is on (first statement, before any write) and releases the pen and any open path edit inside the existing `if (on)` block. The exit edge never calls either action, so `enterVectorPen`'s own `setAquarelleSelectMode(false)` cannot cancel the pen it just latched.
- `setAquarellePickerLatched` calls both exits on the `false → true` edge, after the compare-then-write early return and before writing the picker signal; `disarmAquarellePicker` and `toggleAquarellePickerLatched` are untouched.
- The picker header contract is amended, not weakened: the latch leaf is named as the single permitted sibling import and a static pin (T-61-60) asserts the picker's exact two import lines.
- The session's import-list pin is renamed and replaced, not deleted: four lines (preact, picker, selection, latches) and a title that names three sibling surfaces.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: pin the Select release and the wireframe refusal** - `79b722891` (test)
2. **Task 1 GREEN: release the pen on Select entry, refuse entry under wireframe** - `a9d11e85e` (feat)
3. **Task 2 RED: pin the picker latch release and the one-way edge** - `cbbbe6524` (test)
4. **Task 2 GREEN: release the pen when the picker latches** - `8acd9cfad` (feat)

**Plan metadata:** recorded with the docs commit that carries this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathLatches.ts` - the dependency-free leaf: three moved signals, the anchor-selection writers, `writeIfChanged`, `exitVectorPen`, `exitPathEdit`
- `app/src/components/physic-paint/view/vectorPathLatches.test.ts` - three cases: signal identity through the re-export, compare-then-write exits, `exitPathEdit` clearing the selection
- `app/src/components/physic-paint/view/vectorPathSession.ts` - re-exports the leaf; keeps the draft session and the entry arbitration; no longer owns the moved symbols
- `app/src/components/physic-paint/view/vectorPathSession.test.ts` - the renamed/replaced four-line import pin; the other two session-only pins unchanged
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` - `wireframeMode` gate at the top of `setAquarelleSelectMode`; `exitVectorPen()` / `exitPathEdit()` on the entry edge
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` - five new cases (71 → 76): pen release, edit close + selection clear, exit guard, wireframe refusal (both surfaces preserved), wireframe exit still allowed
- `app/src/components/physic-paint/view/aquarelleColorPicker.ts` - latch-edge exits plus the amended one-way-edge header
- `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts` - five new cases (33 → 38): pen release, edit close, disarm guard, repeated-latch notification counts, the T-61-60 import pin

## Decisions Made

- The session keeps `export *` plus an explicit import list rather than re-declaring wrappers: the leaf's signals are the same objects (pinned by identity), so module state cannot diverge.
- `type Signal` is removed from the session's preact import after `writeIfChanged` moves (noUnusedLocals); the replaced pin asserts the new truthful line, so the pin continues to state exactly what the module imports.
- The wireframe refusal runs before the type-filter reset and the Draft reset: a refused entry must not write anything, and a test asserts the pen, the edit and its selection all survive.
- Release calls run inside the same `if (on)` block as the picker and rail-motion disarms, keeping every entry-side release together and the exit edge free of them.
- The picker pin asserts exact import lines instead of a forbidden list: it proves both that the leaf is imported and that nothing else is.
- The RED scaffold (`export {}`) was replaced by the real leaf in GREEN and is gone from the tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed two unused test imports that broke the typecheck**
- **Found during:** Task 1 GREEN (`tsc --noEmit`)
- **Issue:** the new selection-test import block carried `exitPathEdit` and `exitVectorPen`, but the suite resets through `resetForStudioOpen`; `noUnusedLocals: true` reported TS6133 on both.
- **Fix:** dropped both from the test import (the leaf suite is where the exits are exercised directly).
- **Files modified:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts`
- **Verification:** `pnpm exec tsc --noEmit` exits 0; the three suites stay 95/95.
- **Committed in:** `a9d11e85e`

**2. [Rule 2 - Missing Critical] Added the T-61-60 static import pin as a fifth picker case**
- **Found during:** Task 2 RED planning
- **Issue:** the plan's behavior block lists four picker cases, but its threat register assigns `mitigate` to T-61-60 with "a static source assertion pins the picker's forbidden imports". Without that assertion the amended header contract is unenforced, and the 37-test threshold left room for it.
- **Fix:** added one static test asserting the picker's exact import lines (`@preact/signals` + `./vectorPathLatches`), so any future sibling import fails the suite. The picker suite lands at 38 tests (threshold was 37).
- **Files modified:** `app/src/components/physic-paint/view/aquarelleColorPicker.test.ts`
- **Verification:** 38/38 after GREEN; the pin failed at RED exactly as planned (one line vs two).
- **Committed in:** `cbbbe6524`

---

**Total deviations:** 2 auto-fixed (1 typecheck cleanup, 1 threat-mitigation assertion)
**Impact on plan:** Neither changed scope: the cleanup keeps `noUnusedLocals` green, and the extra pin implements a mitigation the plan's own threat register requires.

## Issues Encountered

- The first Task 1 RED record was rejected as `invalid_record` although it carried `command`/`exitCode`/`output`: the classifier needs `targetTest` (and `targetFile`) to match the failing target in the JUnit report. The record was rebuilt with the full field set (`targetTest`, `targetFile`, `expected`, `actual`, `reportPath`, `runStartedAt`, `reportModifiedAt`, `semanticAssessment`) and the unchanged report; the gate then returned `RED_EVIDENCE_OK`.
- `pnpm exec vitest run` prints pre-existing sourcemap warnings from `@efxlab/motion-canvas-core`; they are unrelated to this plan and were not addressed (out of scope).

## TDD Gate Compliance

- Task 1: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (7 failing / 88 passing of 95 at RED; the target was the Select-entry pen release). GREEN: 95/95 across the three suites.
- Task 2: `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`, reason `target_test_failed` (3 failing / 35 passing of 38 at RED; the target was the picker-latch pen release). GREEN: 38/38.
- Both GREEN commits were preceded by their RED commit; no production code was written before its RED. The leaf's RED scaffold (`export {}`) is the only non-test file in a RED commit and was replaced in GREEN.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-6 is implemented and pinned. The live UAT row: latch the vector pen, then press Select (rail button, top bar, `A`, Shift+A) — the Select overlay must receive the click and no draft anchors may accumulate. Repeat with a path edit open: entering Select must close the edit.
- Second live row: latch the pen, then press `I` or the rail Picker button — the picker must arm and the pick must land on the sheet.
- Third live row: turn the wireframe on and press Select — nothing may turn on; turning a Select that is already on back off while the wireframe is on must still work.
- 61-18/61-19 can build on the leaf; 61-20's ledger entries are unaffected. No blockers: both new seams fail closed (a refused entry writes nothing; an exit never releases the pen).
- Out of scope and unchanged: WR-01 (`VectorDrawDraft.cursor` is still unread) and WR-05 (the draft's fate on a paint-tool press).

---

*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/vectorPathLatches.ts
- FOUND: app/src/components/physic-paint/view/vectorPathLatches.test.ts
- FOUND: app/src/components/physic-paint/view/vectorPathSession.ts
- FOUND: app/src/components/physic-paint/view/vectorPathSession.test.ts
- FOUND: app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
- FOUND: app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
- FOUND: app/src/components/physic-paint/view/aquarelleColorPicker.ts
- FOUND: app/src/components/physic-paint/view/aquarelleColorPicker.test.ts
- FOUND: 79b722891
- FOUND: a9d11e85e
- FOUND: cbbbe6524
- FOUND: 8acd9cfad
